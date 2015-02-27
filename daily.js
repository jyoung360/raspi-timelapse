var AWS = require('aws-sdk'); 
var sqs = new AWS.SQS({region:'us-west-2'});
var RaspiCam = require("raspicam");
var spawn = require('child_process').spawn;
var moment = require('moment');
var util = require('util');
var sun_tracker = require('./lib/sun_tracker.js');

var takePicture = function(params,callback) {
	putMessage(util.format('Taking pictures with following params: %j',params),function(err,data) {
		var camera = new RaspiCam(params);
		camera.on("exit", function( timestamp ){
			putMessage("All done taking pictures.  Syncing with S3 now.",function(err,data) {
				s3  = spawn('aws', ['s3','sync','timelapse','s3://raspi-timelapse']);
				s3.on('close', function (code, signal) {
					rm  = spawn('rm', ['-f','timelapse/*.jpg']);
					rm.on('close', function (code, signal) {
						return callback();
					});
				});
			});
		});
		camera.start();
	});
}

var putMessage = function(message, callback) {
	console.log(message);
	var params = {
		MessageBody: message+"\n Message sent at: "+moment().format('YYYY-MM-DD HH:mm:ss'),
		QueueUrl: 'https://sqs.us-west-2.amazonaws.com/176232384384/raspi-cam'
	};
	sqs.sendMessage(params, callback);
}

var today = moment();
var timeToSunrise = sun_tracker.getSunrise().diff(today);
var timeToSunset = sun_tracker.getSunset().diff(today);

var params = {
	mode : "timelapse",
	output : "test_%06d.jpg",
	width : 800,
	height : 600,
	quality : 75,
	timeout : timeToSunset-timeToSunrise,
	encoding : "jpg",
	timelapse : 60000
}

if(timeToSunrise < 0) { 
	var message = 'Missed timelapse today.  Sunrise: '+sun_tracker.getSunrise().format('HH:mm')+' Sunset: '+sun_tracker.getSunset().format('HH:mm');
	putMessage(message,function(err,data) {
		if(err) {
			return console.error(err)
		}
	});
}
else {
	var message = 'Timelapse starting in '+timeToSunrise+'ms Sunrise today: '+sun_tracker.getSunrise().format('HH:mm')+' Sunset today: '+sun_tracker.getSunset().format('HH:mm');
	putMessage(message, function(err,data) {
		if(err) { return console.error(err); }
		setTimeout(function(){
			console.log("taking picture in %j",timeToSunrise);
			takePicture(
				params, 
				function() { putMessage("Sync and cleanup complete.  All done for today!",function(err,data) {
					return;
				})}
			);
		},timeToSunrise);	
	});
}

return;



var getMessage = function(err, callback) {
	if(err) { console.log('got an error while getting message',err, err.stack); }
	var params = {
		QueueUrl: 'https://sqs.us-west-2.amazonaws.com/176232384384/raspi-cam', /* required */
		MaxNumberOfMessages: 1,
		VisibilityTimeout: 0,
		WaitTimeSeconds: 20
	};
	sqs.receiveMessage(params, callback);
}

var handleMessage = function(err,data) {
        if (err) {
                return callback(err);
        }
        else {
		console.log('got a message %s',data.Messages);
		if(data.Messages) {
			takePicture(data.Messages[0].Body,function() {
					deleteMessage(data, function(err,data) {
						if(err) { console.log(err); }
						console.log(data);
					});
				},function() {
					getMessage(null,handleMessage) 
				});
        	}
		else {
			return getMessage(null,handleMessage);
		}
	}
}

var deleteMessage = function(data,callback) {
        var params = {
                QueueUrl: 'https://sqs.us-west-2.amazonaws.com/176232384384/raspi-cam',
                ReceiptHandle: data.Messages[0].ReceiptHandle
        };
	console.log('deleting message %s %s',params.QueueUrl,params.ReceiptHandle);
        sqs.deleteMessage(params, callback);
}

getMessage(null, handleMessage);

