'use strict';

const convert = require('xml-js');
const Transport = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const Message = require('azure-iot-device').Message;
const http = require('http')
const server = http.createServer();
var edge_client;
var serverport = process.env.SERVER_PORT;

const makeDate = () => {
	var d = new Date();
	var tmp = '';
	var months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

	tmp += d.getFullYear();
	tmp += '-';
	tmp += months[d.getMonth()];
	tmp += '-';
	tmp += ('00' + d.getDate()).slice(-2);
	tmp += ' ';
	tmp += ('00' + d.getHours()).slice(-2);
	tmp += ':';
	tmp += ('00' + d.getMinutes()).slice(-2);
	tmp += ':';
	tmp += ('00' + d.getSeconds()).slice(-2);

	return tmp;
};

const makeXMLresponse = () => {
	var xmlString =
		'\n<?xml version="1.0" encoding="UTF-8"?>' +
		'\n<tohostresponse xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://tdc.skf.com/XSD/tohostresponse.xsd"> ' +
		'\n\n  <status> ' +
		'\n    <code>0</code> ' +
		'\n    <message>OK</message> ' +
		'\n  </status> ' +
		'\n  <timestamp>' +
		makeDate() +
		'</timestamp> ' +
		'\n\n</tohostresponse> ';

	return xmlString;
};

const collectData = (request, callback) => {
	let body = '';
	request.on('data', (chunk) => {
		body += chunk.toString();
	});
	request.on('end', () => {
		callback(body);
	});
};

server.on('connection', (socket) => {
	console.log('connection from:', socket.remoteAddress);

	/*
  var obj = { message: "http connection to gg", source: socket.remoteAddress }; 
  iotClient.publish({topic:'cmsAdapter/connection', payload:JSON.stringify(obj),}, publishCallback);
  */
});

server.on('request', function (req, res) {
	var responsestring = makeXMLresponse();

	if (req.method === 'POST') {
		collectData(req, (result) => {
			res.writeHead(200, {
				'Content-Type': 'text/html; charset=utf-8',
				'Content-Length': Buffer.byteLength(responsestring),
			});
			res.end(responsestring);

			var rawmessageasjson = convert.xml2json(result, { compact: true, spaces: 4 });
			pipeMessage(rawmessageasjson);
		});
	} else {
		res.writeHead(200, {
			'Content-Type': 'text/html; charset=utf-8',
			'Content-Length': Buffer.byteLength(responsestring),
		});
		res.end(responsestring);
		var obj = { message: 'message recieved', url: req.url, method: req.method };
	}
});

exports.handler = function handler(event, context) {
	console.log(event);
	console.log(context);
};

Client.fromEnvironment(Transport, function (err, client) {
	if (err) {
		throw err;
	} else {
		client.on('error', function (err) {
			throw err;
		});

		// connect to the Edge instance
		client.open(function (err) {
			if (err) {
				throw err;
			} else {
				console.log('IoT Hub module client initialized');
				edge_client = client;

				// start liostening to OPC DA
				server.listen(serverport);
				console.log('listening for OPC DA messages on ' + serverport);
			}
		});
	}
});

// This function just pipes the messages without any change.
const pipeMessage = (json_msg) => {
	let message = JSON.stringify(json_msg);
	edge_client.complete(message, printResultFor('Receiving message'));

	var outputMsg = new Message(message);
	client.sendOutputEvent('output1', outputMsg, printResultFor('Sending received message'));
};

// Helper function to print results in the console
const printResultFor = (op) => {
	return function printResult(err, res) {
		if (err) {
			console.log(op + ' error: ' + err.toString());
		}
		if (res) {
			console.log(op + ' status: ' + res.constructor.name);
		}
	};
};
