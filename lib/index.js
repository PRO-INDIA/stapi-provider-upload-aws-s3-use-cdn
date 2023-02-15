"use strict";

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const request = require("request");
const _ = require("lodash");
const AWS = require("aws-sdk");

module.exports = {
  init(config) {
    const S3 = new AWS.S3({
      apiVersion: "2006-03-01",
      ...config,
    });

    const getAuth0Token = (Key) => {
      var options = {
        method: "POST",
        url: `${config.auth0Url}`,
        headers: { "content-type": "application/json" },
        body: `{"client_id":"${config.auth0ClientId}","client_secret":"${config.auth0ClientSecret}","audience":"https://quickstarts/api","grant_type":"client_credentials"}`,
      };
      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        sendRequestToApi(JSON.parse(body)["access_token"], Key);
      });
    };

    const sendRequestToApi = (apiToken, Key) => {
      console.log(Key);
      const message = { target: "s3", type: "video", filepath: `${Key}` };
      var options = {
        method: "POST",
        url: `${config.apiUrl}blob/sendToQueue/filecompressionqueue`,
        headers: { Authorization: `Bearer ${apiToken}` },
        body: message,
        json: true,
      };
      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        console.log("File send to queue for compression");
      });
    };

    const upload = (file, customParams = {}) =>
      new Promise(async (resolve, reject) => {
        const cdnDomain = config.cdnDomain;
        const path = file.path ? `${file.path}/` : config.bucketSubDirectory;
        const Key = `${path}${file.hash}${file.ext}`;

        // upload file on S3 bucket
        S3.upload(
          {
            Key,
            Body: file.stream || Buffer.from(file.buffer, "binary"),
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

        if (file.mime.includes("video")) {
          getAuth0Token(Key);
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
          const path = file.path ? `${file.path}/` : "";
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
