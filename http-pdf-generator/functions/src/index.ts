import "module-alias/register";
import * as admin from "firebase-admin";

admin.initializeApp();

import * as functions from "firebase-functions";
import { ParamsDictionary } from "express-serve-static-core";
import { parseParameters } from "./parse_parameters";
import { producePdf } from "lib/produce_pdf";
import { runAction } from "lib/utilities/action";
import { createErrorHandler } from "lib/utilities/error_handler";
import { extensionParameters } from "lib/utilities/extension_parameters";

process.on("unhandledRejection", (reason, p) => {
  console.error(reason, "Unhandled Rejection at Promise", p);
});

exports.executePdfGenerator = functions.https.onRequest(
  async (request: functions.Request<ParamsDictionary>, response) => {
    const errorHandler = createErrorHandler({
      response,
      context: {
        method: request.method,
        body: request.body,
        query: request.query,
      },
    });

    try {
      process.on("uncaughtException", errorHandler);

      // Check type of request
      const requestType = request.method;
      let getParameters: any;
      if (requestType == 'POST') {
        // If POST request, merge data from request query and JSON body
        getParameters = {
          ...request.query,
          ...request.body,
        };
      } else {
        // Otherwise (GET), just use query
        getParameters = request.query;
      }

      // Use new version of parameters for parsing
      const parameters = runAction(parseParameters, {
        getParameters: getParameters,
      });

      const { pdf, functionContext } = await runAction(producePdf, {
        parameters,
      });

      if (extensionParameters.RETURN_PDF_IN_RESPONSE.toLowerCase() === "yes") {
        response.setHeader(
          "content-type",
          `application/pdf; filename="${parameters.outputFileName}"`
        );
        response.setHeader(
          "content-disposition",
          `inline; filename="${parameters.outputFileName}"`
        );
        response.end(pdf);
      } else {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ done: "successful", functionContext }));
      }
    } catch (error) {
      functions.logger.error("Error", error);
      if (error instanceof Error) {
        errorHandler(error);
      }
    } finally {
      process.removeListener("uncaughtException", errorHandler);
    }
  }
);
