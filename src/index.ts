import runGateway from "./gateway.js";
import runCommunicator from "./server.js";

console.log("Starting services....");
runGateway();
runCommunicator();
