/*
HOST=$1
CIUID=$2
STATE=$3
PROTOCOL=$4
PORT=$5
USER_NAME=$6
PASS_WORD=$7
DOMAIN=$8
*/


//node apache_server_status_monitor.js "127.0.0.1" "2392" "1,1,1,1,1,1,1,1" "http" "80" """" """" """" 
var urlLib = require("url");

var metrics = []

metrics["BusyWorkers"] = {id:"158:4",value:"", retrieve:false};
metrics["IdleWorkers"] = {id:"31:4",value:"", retrieve:false};
metrics["Total kBytes"] = {id:"110:4",value:"", retrieve:false};
metrics["Uptime"] = {id:"205:4",value:"", retrieve:false};
metrics["ReqPerSec"] = {id:"73:4",value:"", retrieve:false};
metrics["BytesPerSec"] = {id:"90:4",value:"", retrieve:false};
metrics["BytesPerReq"] = {id:"5:4",value:"", retrieve:false};
metrics["Status"] = {id:"2:9",value:"", retrieve:false};

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;





// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(3);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(9);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(2);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 8)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//url
	var host = args[0];
	
	//target id
	var targetId = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsName = Object.keys(metrics);
	
	if (tokens.length === metricsName.length)
	{
		for(var i in tokens)
		{
			metrics[metricsName[i]].retrieve = (tokens[i] === "1")
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}

	//protocol
	var protocol = args[3];
	
	
	//port
	var port = args[4];
	port = port === "\"\"" ? "" : port;
	if(port.length === 1 && port === "\"")
		port = "";
	port = port.length === 0 ? null : port;
	
	
	// Username
	var username = args[5];
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	username = username.length === 0 ? null : username;
		
	
	// Password
	var passwd = args[6];
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	passwd = passwd.length === 0 ? null : passwd;
	
	
	//domain
	var domain = args[7];
	domain = domain === "\"\"" ? "" : domain;
	if(domain.length === 1 && domain === "\"")
		domain = "";
	domain = domain.length === 0 ? null : domain;

	
	var fullUsername = "";
	
	if (domain != null && username != null)
		fullUsername = domain + "\\" + username;
	else
		fullUsername = username;
	
	
	
	var request = new Object();
	request.host = host;
	request.targetId = targetId;
	request.protocol = protocol;
	request.port = port;
	request.username = fullUsername;
	request.passwd = passwd;
	request.domain = domain;
	
	monitorApacheServerStatus(request);
}




//################### OUTPUT ###########################

function output(request)
{
	var metricsName = Object.keys(metrics);
	
	var date = new Date().toISOString();
	
	for(var i in metricsName)
	{
		var out = "";
		
		var metric = metrics[metricsName[i]];
		
		if(metric.retrieve)
		{
			out += date;
			out += "|";
			out += metric.id;
			out += "|";
			out += request.targetId;
			out += "|";
			
			if(metricsName[i] === "BytesPerSec" || metricsName[i] === "BytesPerReq")
				out += (metric.value / 1024).toFixed(2);
			else if(metricsName[i] === "ReqPerSec")
				out += parseFloat(metric.value);
			else
				out += metric.value
		
			console.log(out);
		}
	}
	
}


function processMetricOnError(request)
{
	var out = "";
	
	out += new Date().toISOString();
	out += "|";
	out += metrics["Status"].id;
	out += "|";
	out += request.targetId;
	out += "|";
	out += "0"
	
	console.log(out);
}


function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(2);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}


// ################# MONITOR ###########################

function monitorApacheServerStatus(request) {

    var start = Date.now();

	var default_port;
	
	if (request.protocol == 'http') 
	{
		http = require("http");
		default_port = request.port == null?80:request.port;
	}
	else
	{
		http = require("https");
		default_port = request.port == null?443:request.port;
	}
	
	
    var options;
    options = {
        hostname: request.host,
        path: '/server-status?auto',
        method: 'GET',
        port: default_port,
        auth: '',
        headers: ''
    };

    if (request.username != null && request.passwd != null) {
        options.auth = request.username + ':' + request.passwd;
    }


    var req = http.request(options, function (res) {
        var data = '';
		
        var code = res.statusCode;
		
		if (code != 200)
		{
			if (code == 401)
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else
			{
				processMetricOnError(request)
			}
		}
			
        res.setEncoding('utf8');
        // On each chunk
        res.on('data', function (chunk) {
            data += chunk;
        });
        // On End
        res.on('end', function (res) {
		
            var metricsName = Object.keys(metrics);
			
			
			if(data.indexOf("Uptime") > -1)
			{
				metrics["Status"].value = 1;
				
				var d = data.split("\n");
			
				
				for(var j in metricsName)
				{	
					if(metrics[metricsName[j]].retrieve)
					{
						for(var i in d)
						{
							var lineValues = d[i].split(": ");
							
							if(lineValues.length > 1 && lineValues[0] === metricsName[j])
							{
								metrics[metricsName[j]].value = lineValues[1];
								break;
							}
						}
					}
				}
				
				output(request);
				
			}
			else
			{
				processMetricOnError(request)
			}


        });
    });
	
    // On Error
    req.on('error', function (e) {
		processMetricOnError(request)
    });

    req.end();
}