var AWS = require('aws-sdk'); 
var sqs = new AWS.SQS({region:'us-west-2'});
var RaspiCam = require("raspicam");
var spawn = require('child_process').spawn;

var takePicture = function(params,deleteFunction,callback) {
	deleteFunction();
	var camera = new RaspiCam(JSON.parse(params));

	camera.on("exit", function( timestamp ){
		console.log("photo child process has exited at " + timestamp );
		s3  = spawn('aws', ['s3','sync','timelapse','s3://raspi-timelapse']);
		s3.on('close', function (code, signal) {
	        	console.log('S3 sync completed with code %s',code);
			rm  = spawn('rm', ['-rf','timelapse/*']);
                	rm.on('close', function (code, signal) {
                	        console.log('remove images completed with code %s',code);
                	        return callback();
                	});
		});
	});

	camera.start();
}

var getMessage = function(err, callback) {
	if(err) { console.log('got an error while getting message',err, err.stack); }
	var params = {
		QueueUrl: 'https://sqs.us-west-2.amazonaws.com/176232384384/raspi-cam', /* required */
		MaxNumberOfMessages: 1,
		VisibilityTimeout: 0,
		WaitTimeSeconds: 0
	};

	setTimeout(function() {
		sqs.receiveMessage(params, callback);
	},60000);
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

