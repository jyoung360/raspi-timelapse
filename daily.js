var AWS = require('aws-sdk'); 
var sqs = new AWS.SQS({region:'us-west-2'});
var RaspiCam = require("raspicam");
var spawn = require('child_process').spawn;
var moment = require('moment');

var RADIANS = function(degrees) {
	return degrees * (Math.PI/180);
}
var DEGREES = function(radians) {
	return radians * (180/Math.PI);
}

var getSunriseSunset = function(date) {
	var dayOfYear = date.dayOfYear();
	var D2 = Math.floor(((2015-1900)*365.25)+dayOfYear);
	var lat = 47.6097;
	var lng = -122.3331;
	var tmz_offset = -8;
	var F2 = D2+2415018.5-tmz_offset/24;
	var G2 = (F2-2451545)/36525;
	var I2 = (280.46646+G2*(36000.76983 + G2*0.0003032))%360;
	var J2 = 357.52911+G2*(35999.05029 - 0.0001537*G2);
	var L2 = Math.sin(RADIANS(J2))*(1.914602-G2*(0.004817+0.000014*G2))+Math.sin(RADIANS(2*J2))*(0.019993-0.000101*G2)+Math.sin(RADIANS(3*J2))*0.000289;
	var M2 = I2+L2;
	var K2 = 0.016708634-G2*(0.000042037+0.0000001267*G2);
	var P2 = M2-0.00569-0.00478*Math.sin(RADIANS(125.04-1934.136*G2));
	var Q2 = 23+(26+((21.448-G2*(46.815+G2*(0.00059-G2*0.001813))))/60)/60;
	var R2 = Q2+0.00256*Math.cos(RADIANS(125.04-1934.136*G2));
	var U2 = Math.tan(RADIANS(R2/2))*Math.tan(RADIANS(R2/2));
	var T2 = DEGREES(Math.asin(Math.sin(RADIANS(R2))*Math.sin(RADIANS(P2))));
	var V2 = 4*DEGREES(U2*Math.sin(2*RADIANS(I2))-2*K2*Math.sin(RADIANS(J2))+4*K2*U2*Math.sin(RADIANS(J2))*Math.cos(2*RADIANS(I2))-0.5*U2*U2*Math.sin(4*RADIANS(I2))-1.25*K2*K2*Math.sin(2*RADIANS(J2)))
	var W2 = DEGREES(Math.acos(Math.cos(RADIANS(90.833))/(Math.cos(RADIANS(lat))*Math.cos(RADIANS(T2)))-Math.tan(RADIANS(lat))*Math.tan(RADIANS(T2))))
	var X2 = (720-4*lng-V2+tmz_offset*60)/1440;
	var sunrise = X2-W2*4/1440;
	var sunset = X2+W2*4/1440;
	return { sunrise: sunrise, sunset: sunset}
}

var takePicture = function(params,callback) {
	try {
		var camera = new RaspiCam(params);
		camera.on("exit", function( timestamp ){
			console.log("photo child process has exited at " + timestamp );
			s3  = spawn('aws', ['s3','sync','timelapse','s3://raspi-timelapse']);
			s3.on('close', function (code, signal) {
				console.log('S3 sync completed with code %s',code);
				rm  = spawn('rm', ['-f','timelapse/*.jpg']);
				rm.on('close', function (code, signal) {
					console.log('remove images completed with code %s',code);
					return callback();
				});
			});
		});
		camera.start();
	}
	catch(e) {
		console.log("JSON parsed camera params error: "+e);
	}

}

var putMessage = function(err, callback) {
	if(err) { console.log('got an error while getting message',err, err.stack); }
	var params = {
		QueueUrl: 'https://sqs.us-west-2.amazonaws.com/176232384384/raspi-cam', /* required */
		MaxNumberOfMessages: 1,
		VisibilityTimeout: 0,
		WaitTimeSeconds: 20
	};
	sqs.receiveMessage(params, callback);
}

var today = moment();
var results = getSunriseSunset(today);
var timeToSunrise = today.startOf('day').add(24*3600*1000*results.sunrise,"ms").diff(moment());
var timeToSunset = today.startOf('day').add(24*3600*1000*results.sunset,"ms").diff(moment());

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
	console.log('Sorry sunrise was %s ago, will try again tomorrow.',moment.duration(timeToSunrise).humanize());
	return;
}

setTimeout(function(){
	console.log("taking picture in %j",timeToSunrise);
	takePicture(params, function(){ console.log('done');});
},timeToSunrise);
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

