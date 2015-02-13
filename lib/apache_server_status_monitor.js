/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0

 DESCRIPTION: Monitor Apache Server Status utilization

 SYNTAX: node apache_server_status_monitor.js <HOST> <METRIC_STATE> <PROTOCOL> <PORT> <USER_NAME> <PASS_WORD> <DOMAIN>
 
 EXAMPLE: node apache_server_status_monitor.js "127.0.0.1" "1,1,1,1,1,1,1,1" "http" "80" "" "" ""

 README:
		<HOST> hostname or ip address to apache server
		
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off

		<PROTOCOL> protocol used in apache server status page

		<PORT> port used in apache

		<USER_NAME>, <PASS_WORD> and <DOMAIN> only if required depending on apache server configuration. Leave this parameters empty ("") if you don't need them.
*/

/*
* METRICS IDS
* List with all metrics to be retrieved.
*
* Attribute "id" represents the metric id
* Attribute "value" used to store the metric value during retrieval
* Attribute "retrieve" represents the metric state
*/
var metrics = []

metrics["BusyWorkers"] = {id:"158:Busy Workers:4",value:"", retrieve:false};
metrics["IdleWorkers"] = {id:"31:Idle Workers:4",value:"", retrieve:false};
metrics["Total kBytes"] = {id:"110:Total KBytes:4",value:"", retrieve:false};
metrics["Uptime"] = {id:"205:Uptime:4",value:"", retrieve:false};
metrics["ReqPerSec"] = {id:"73:Requests/Sec:4",value:"", retrieve:false};
metrics["BytesPerSec"] = {id:"90:KBytes/Sec:4",value:"", retrieve:false};
metrics["BytesPerReq"] = {id:"5:KBytes/Request:4",value:"", retrieve:false};
metrics["Status"] = {id:"2:Status:9",value:"", retrieve:false};


// ############# INPUT ###################################

//START
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
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 7)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorApacheServerStatus)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
      
	//<HOST>
	var host = args[0];
	
	//<METRIC_STATE>
	var metricState = args[1].replace("\"", "");
	
	var tokens = metricState.split(",");
	
	var metricsName = Object.keys(metrics);

	for(var i in tokens)
	{
		metrics[metricsName[i]].retrieve = (tokens[i] === "1")
	}

	//<PROTOCOL>
	var protocol = args[2];
		
	//<PORT>
	var port = args[3];
	port = port === "\"\"" ? "" : port;
	if(port.length === 1 && port === "\"")
		port = "";
	port = port.length === 0 ? null : port;
	
	
	// <USER_NAME>
	var username = args[4];
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	username = username.length === 0 ? null : username;
		
	
	// <PASS_WORD>
	var passwd = args[5];
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	passwd = passwd.length === 0 ? null : passwd;
	
	
	// <DOMAIN>
	var domain = args[6];
	domain = domain === "\"\"" ? "" : domain;
	if(domain.length === 1 && domain === "\"")
		domain = "";
	domain = domain.length === 0 ? null : domain;

	

	var fullUsername = "";
	
	if (domain != null && username != null)
		fullUsername = domain + "\\" + username;
	else
		fullUsername = username;
	
	
	//create request object to pass to the monitor
	var request = new Object();
	request.host = host;
	request.protocol = protocol;
	request.port = port;
	request.username = fullUsername;
	request.passwd = passwd;
	request.domain = domain;
	
	//call monitor
	monitorApacheServerStatus(request);
}



// ################# Apache Server Status ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorApacheServerStatus(request) 
{
	var default_port;
	
	//select type of module to use (http or https)
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
	
	// create http request options
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

	//do http request
    var req = http.request(options, function (res) {
        var data = '';
		
        var code = res.statusCode;
		
		if (code != 200)
		{
			//Invalid authentication
			if (code == 401)
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else
			{
				processMetricOnError();
				return;
			}
		}
			
        res.setEncoding('utf8');
		
        // receive data
        res.on('data', function (chunk) {
            data += chunk;
        });
		
        // On http request end
        res.on('end', function (res) {
		
            var metricsName = Object.keys(metrics);
			
			//find uptime metric in response
			if(data.indexOf("Uptime") > -1)
			{
				metrics["Status"].value = 1;
				
				var d = data.split("\n");
				
				//retrieve metric values
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
					
					//check if metric was found
					if(metrics[metricsName[j]].value === "")
					{
						var error = MetricNotFoundError();
						error.message = "Unable to collect metric " + metrics[metricsName[j]].id;
						errorHandler(error);
					}
				}
				
				//send metrics to output
				output();
				
			}
			else
			{
				// output status set to 0
				processMetricOnError();
				return;
			}
			
        });
    });
	
    // On error
    req.on('error', function (e) {
		// output status set to 0
		processMetricOnError()
    });

    req.end();
}


//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
*/
function output()
{
	var metricsName = Object.keys(metrics);
	
	for(var i in metricsName)
	{
		var out = "";
		
		var metric = metrics[metricsName[i]];
		
		if(metric.retrieve)
		{
			out += metric.id;
			out += "|";
			
			if(metricsName[i] === "BytesPerSec" || metricsName[i] === "BytesPerReq")
				out += (metric.value / 1024).toFixed(2);
			else if(metricsName[i] === "ReqPerSec")
				out += parseFloat(metric.value);
			else
				out += metric.value
		
			out += "|";
			console.log(out);
		}
	}
	
}

/*
* Send metric Status to console.
* Used on error.
*/
function processMetricOnError()
{
	if(metrics["Status"].retrieve)
	{
		var out = "";
		
		out += metrics["Status"].id;
		out += "|";
		out += "0";
		out += "|";
		
		console.log(out);
	}
}



//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof MetricNotFoundError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
	
}



//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;


function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;


function MetricNotFoundError() {
    this.name = "MetricNotFoundError";
    this.message = "";
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;