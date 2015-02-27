var moment = require('moment');

(function () {
	var lat = 47.6097;
	var lng = lng || -122.3331;
	var tmz_offset = tmz_offset || -8;
	var date = date || moment();
	var dayOfYear = date.dayOfYear();
	var daysSince1900
	, julianDate
	, julianCentury
	, localTime
	, geometicMeanLongSun
	, geometicMeanAnomSun
	, eccentricEarthOrbit
	, sunEqCtr
	, sunTrueLong
	, sunTrueAnom
	, sunRadVector
	, sunAppLong
	, meanObliqEcliptic
	, obliqueCorrection
	, sunRightAscension
	, sunDeclination
	, U2
	, equationOfTime
	, haSunrise
	, solarNoon
	, sunrise
	, sunset
	, sunlightDuration
	, trueSolarTime
	, hourAngle
	, solarZenithAngle
	, solarElevationAngle;

	var config = function(options) {
		options = options || {};
		lat = options.lat || lat;
		lng = options.lng || lng;
		tmz_offset = options.tmz_offset || -8;
		date = options.date || date;

		calculate();
	}

	var RADIANS = function(degrees) {
		return degrees * (Math.PI/180);
	}
	var DEGREES = function(radians) {
		return radians * (180/Math.PI);
	}

	var calculate = function() {
		daysSince1900 = Math.floor(((2015-1900)*365.25)+dayOfYear);
		julianDate = daysSince1900+2415018.5-tmz_offset/24;
		julianCentury = (julianDate-2451545)/36525;
		localTime = 0;
		geometicMeanLongSun = (280.46646+julianCentury*(36000.76983 + julianCentury*0.0003032))%360;
		geometicMeanAnomSun = 357.52911+julianCentury*(35999.05029 - 0.0001537*julianCentury);
		eccentricEarthOrbit = 0.016708634-julianCentury*(0.000042037+0.0000001267*julianCentury);
		sunEqCtr = Math.sin(RADIANS(geometicMeanAnomSun))*(1.914602-julianCentury*(0.004817+0.000014*julianCentury))+Math.sin(RADIANS(2*geometicMeanAnomSun))*(0.019993-0.000101*julianCentury)+Math.sin(RADIANS(3*geometicMeanAnomSun))*0.000289;
		sunTrueLong = geometicMeanLongSun+sunEqCtr;
		sunTrueAnom = geometicMeanAnomSun+sunEqCtr;
		sunRadVector = (1.000001018*(1-eccentricEarthOrbit*eccentricEarthOrbit))/(1+eccentricEarthOrbit*Math.cos(RADIANS(sunTrueAnom)));
		sunAppLong = sunTrueLong-0.00569-0.00478*Math.sin(RADIANS(125.04-1934.136*julianCentury));
		meanObliqEcliptic = 23+(26+((21.448-julianCentury*(46.815+julianCentury*(0.00059-julianCentury*0.001813))))/60)/60;
		obliqueCorrection = meanObliqEcliptic+0.00256*Math.cos(RADIANS(125.04-1934.136*julianCentury));
		sunRightAscension = DEGREES(Math.atan2(Math.cos(RADIANS(sunAppLong)),Math.cos(RADIANS(obliqueCorrection))*Math.sin(RADIANS(sunAppLong))))
		sunDeclination = DEGREES(Math.asin(Math.sin(RADIANS(obliqueCorrection))*Math.sin(RADIANS(sunAppLong))));
		U2 = Math.tan(RADIANS(obliqueCorrection/2))*Math.tan(RADIANS(obliqueCorrection/2));
		equationOfTime = 4*DEGREES(U2*Math.sin(2*RADIANS(geometicMeanLongSun))-2*eccentricEarthOrbit*Math.sin(RADIANS(geometicMeanAnomSun))+4*eccentricEarthOrbit*U2*Math.sin(RADIANS(geometicMeanAnomSun))*Math.cos(2*RADIANS(geometicMeanLongSun))-0.5*U2*U2*Math.sin(4*RADIANS(geometicMeanLongSun))-1.25*eccentricEarthOrbit*eccentricEarthOrbit*Math.sin(2*RADIANS(geometicMeanAnomSun)))
		haSunrise = DEGREES(Math.acos(Math.cos(RADIANS(90.833))/(Math.cos(RADIANS(lat))*Math.cos(RADIANS(sunDeclination)))-Math.tan(RADIANS(lat))*Math.tan(RADIANS(sunDeclination))))
		solarNoon = (720-4*lng-equationOfTime+tmz_offset*60)/1440;
		sunrise = solarNoon-haSunrise*4/1440;
		sunset = solarNoon+haSunrise*4/1440;
		sunlightDuration = 8*haSunrise;
		trueSolarTime = (localTime*1440+equationOfTime+4*lng-60*tmz_offset)%1440;
		hourAngle = (trueSolarTime/4<0)?trueSolarTime/4+180:trueSolarTime/4-180;
		solarZenithAngle = DEGREES(Math.acos(Math.sin(RADIANS(lat))*Math.sin(RADIANS(sunDeclination))+Math.cos(RADIANS(lat))*Math.cos(RADIANS(sunDeclination))*Math.cos(RADIANS(hourAngle))));
		solarElevationAngle = 90-solarZenithAngle;
		return this;
	}

	var getSunrise = function() {
		return date.startOf('day').add(24*3600*1000*sunrise,"ms");
	}

	var getSunset = function() {
		return date.startOf('day').add(24*3600*1000*sunset,"ms");
	}

	config();

	exports.config = config;
	exports.getSunrise = getSunrise;
	exports.getSunset = getSunset;
})();