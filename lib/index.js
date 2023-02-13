'use strict';

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const { QueueServiceClient } = require("@azure/storage-queue");
const _ = require('lodash');
const AWS = require('aws-sdk');s

module.exports = {
  init(config) {
    const S3 = new AWS.S3({
      apiVersion: '2006-03-01',
      ...config,
    });

    const getQueueClientAsync=  (queueName) =>{
      const queueServiceClient = new QueueServiceClient.fromConnectionString(config.azureStorageConnectionString);
      const queueClient = queueServiceClient.getQueueClient(queueName);
      return queueClient;
    } 

    const upload = (file, customParams = {}) =>
      new Promise((resolve, reject) => {

        const cdnDomain = config.cdnDomain;
        const path = file.path ? `${file.path}/` : config.bucketSubDirectory;
        const Key = `${path}${file.hash}${file.ext}`;
        
        // upload file on S3 bucket
        S3.upload(
          {
            Key,
            Body: file.stream || Buffer.from(file.buffer, 'binary'),
            ContentType: file.mime,
            ...customParams,
          },
          (err, data) => {
            if (err) {
              return reject(err);
            }

            // set the bucket file url
            file.url = `${cdnDomain}${Key}`;

            resolve();
          }
        );
        if(file.mime.includes("video")){
          const queueClient = getQueueClientAsync(config.queueName);
         const  message = {"target":"s3","type":"video","filepath":Key}
          queueClient.sendMessage(message);  
        }
        
      });

    return {
      uploadStream(file, customParams = {}) {
        return upload(file, customParams);
      },
      upload(file, customParams = {}) {
        return upload(file, customParams);
      },
      delete(file, customParams = {}) {
        return new Promise((resolve, reject) => {
          // delete file on S3 bucket
          const path = file.path ? `${file.path}/` : '';
          S3.deleteObject(
            {
              Key: `${path}${file.hash}${file.ext}`,
              ...customParams,
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }

              resolve();
            }
          );
        });
      },
    };
  },
};
