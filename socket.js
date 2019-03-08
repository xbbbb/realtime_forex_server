var config;
config = require('./config.js');

var token = config.token;
var trading_api_host = config.trading_api_host;
var trading_api_port = config.trading_api_port;
var trading_api_proto = config.trading_api_proto;
var instruments=[];
var init_data=[];
var fs=require('fs');

var floating_rate;




var io = require('socket.io-client');
var socket;
var querystring = require('querystring');
var tradinghttp = require(trading_api_proto);
var request_headers = {
    'User-Agent': 'request',
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
}


var default_callback = (statusCode,data) => {
    if (statusCode === 200) {
        try {
            var jsonData = JSON.parse(data);
        } catch (e) {
           // console.log(e);
            return;
        }
       // console.log( JSON.stringify(jsonData, null, 5));
    } else {
      //  console.log( statusCode, ' : ', data);
    }
}

var authenticate = (token) => {
    socket = io(trading_api_proto + '://' + trading_api_host + ':' + trading_api_port, {
        query: querystring.stringify({
            access_token: token
        })
    });

    // fired when socket.io connects with no errors
    socket.on('connect', () => {
        console.log('Socket.IO session has been opened: ', socket.id);
        request_headers.Authorization = 'Bearer ' + socket.id + token;
        get_instruments();
    });
    // fired when socket.io cannot connect (network errors)
    socket.on('connect_error', (error) => {
        io_server.emit("error","an connection error occur")
       // init_data= JSON.parse(fs.readFileSync('./temp.txt', 'utf8')); 
        if (init_data.length>0) {
            fs.writeFileSync("temp.txt",JSON.stringify(init_data));

        }

    });
    socket.on('error', (error) => {
        io_server.emit("error","an  error occur")
        if (init_data.length>0) {
            fs.writeFileSync("temp.txt",JSON.stringify(init_data));

        }
        console.log(token )
      //  authenticate(token)
        process.exit();
    });
    socket.on('disconnect', () => {
        io_server.emit("error","Disconnected from server")
        if (init_data.length>0) {
            fs.writeFileSync("temp.txt",JSON.stringify(init_data));

        }      
          process.exit();
    });
}

var request_processor = (method, resource, params, callback) => {

    if (typeof(callback) === 'undefined') {
        callback = default_callback;
    }

    // GET HTTP(S) requests have parameters encoded in URL
    if (method === "GET") {
        resource += '/?' + params;
    }
    var req = tradinghttp.request({
        host: trading_api_host,
        port: trading_api_port,
        path: resource,
        method: method,
        headers: request_headers
    }, (response) => {
        var data = '';
        response.on('data', (chunk) => data += chunk); // re-assemble fragmented response data
        response.on('end', () => {
            callback(200, data);
        });
    }).on('error', (err) => {
        callback( 400,err); //
    });

    if (method !== "GET" && typeof(params) !== 'undefined') {
        req.write(params);
    }
    req.end();
};

var priceUpdate = (update) => {
    try {
        var jsonData = JSON.parse(update);
        jsonData.Rates = jsonData.Rates.map(function(element){
            return element.toFixed(5);
        });
        var rate={
            "name":jsonData.Symbol,
            "rate":jsonData.Rates[0]

        }
       // console.log(rate);

        io_server.emit('rate.push',rate);
        for(var i=0;i<init_data.length;i++){
            if(init_data[i].name==rate.name){
                init_data[i]=rate
                return;
            }
        }
    } catch (e) {
        io_server.emit("error","price update fail, please contact the developer immediately ")

        // console.log( e);
        return;
    }
}

var get_instruments=()=>{
    var callback = (statusCode, data)=>{

        try {
            var jsonData = JSON.parse(data);
            for(i=0;i<jsonData.data.instrument.length;i++){
                if(jsonData.data.instrument[i].symbol.toString().indexOf("/")>=0){
                    if(
                        jsonData.data.instrument[i].symbol.toString().indexOf("XAG")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("XAU")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("LTC")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("BTC")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("SEK")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("NOK")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("ZAR")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("TRY")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("MXN")<0&&
                        jsonData.data.instrument[i].symbol.toString().indexOf("ETH")<0){
                        instruments.push(jsonData.data.instrument[i].symbol.toString())
                    }
                }
            }
        } catch (e) {
            io_server.emit("error","get instrument fail, please contact the developer immediately ")
            return;
        }
        console.log(instruments);
        subscribe(instruments);


    }
    request_processor("GET","/trading/get_instruments",null,callback);
}



var subscribe = (pairs) => {

    var callback = (statusCode, data) => {
        try {
            var jsonData = JSON.parse(data);
        } catch (e) {
          //  console.log( e);
            return;
        }
        if(jsonData.response.executed) {
            try {
                for(var i in jsonData.pairs) {
                    socket.on(jsonData.pairs[i].Symbol, priceUpdate);

                    var rate={
                        "name":jsonData.pairs[i].Symbol,
                        "rate":jsonData.pairs[i].Rates[0]
                    }
                    for(var j=0;j<init_data.length;j++){
                        if(rate.name==init_data[j].name){
                            return
                        }
                    }
                    init_data.push(rate);
                }


            } catch (e) {
                io_server.emit("error","subscribe fail, please contact the developer immediately ")
                return;
            }
        }
        else {
            console.log( jsonData);
       	    process.exit();

        }

    }
    request_processor("POST","/subscribe",querystring.stringify({ "pairs":pairs }),callback);
}


//var contents = fs.readFileSync('temp.txt', 'utf8');
//console.log(contents)
//init_data=JSON.parse(contents)
authenticate(token)


const http = require('http');


const hostname = '127.0.0.1';
const port = 3000;


const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    var url = req.url;
    if(url==="/api_LED"){
           

        var result=[];
        var http_floating = require("http");

        var options = {
            "method": "GET",
            "hostname": "fast-forex.com.au",
            "path": "api/LED",
        };

        var req_floating = http_floating.request(options, function (res_floating) {

            var chunks = [];

            res_floating.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res_floating.on("end", function () {
                var content = Buffer.concat(chunks);
                var content_json=JSON.parse(content);
                 floating_rate=content_json.rates;

                for(var i=0; i<floating_rate.length;i++){

                        var mid_one=null;
                        var mid_two=null;
                        for(var j=0;j<init_data.length;j++){
                            if(floating_rate[i].name.indexOf("RMB")>=0){
                                floating_rate[i].name="AUD/CNH"
                            }
                            var currencies=floating_rate[i].name.split("/")
                            if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf(currencies[1])>=0){
                                if(init_data[j].name.indexOf(floating_rate[i].name)>=0){
                                    var temp={
                                        name:floating_rate[i].name,
                                        f2f: (parseFloat( init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                        f2fi:(parseFloat( init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                    }
                                    result.push(temp)
                                    mid_one=null;
                                    mid_two=null;
                                    break;
                                }
                                else{
                                    var temp={
                                        name:floating_rate[i].name,
                                        f2f:(1/parseFloat(init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                        f2fi:(1/parseFloat(init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                    }
                                    result.push(temp)
                                    mid_one=null;
                                    mid_two=null;
                                    break;

                                }
                            }
                            else if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf("USD")>=0){
                                if(init_data[j].name.indexOf(currencies[0])<init_data[j].name.indexOf("USD")){
                                    mid_one=parseFloat(init_data[j].rate);
                                }
                                else{
                                    mid_one=1/parseFloat(init_data[j].rate)
                                }
                            }
                            else if(init_data[j].name.indexOf(currencies[1])>=0&&init_data[j].name.indexOf("USD")>=0){
                                if(init_data[j].name.indexOf(currencies[1])>init_data[j].name.indexOf("USD")){
                                    mid_two=parseFloat(init_data[j].rate);
                                }
                                else{
                                    mid_two=1/parseFloat(init_data[j].rate)
                                }
                            }
                        }
                        if(mid_one!=null&&mid_two!=null){
                            var temp;
                            if(floating_rate[i].name.indexOf("CNH")>=0){
                                temp={
                                    name:"AUD/RMB",
                                    f2f:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                    f2fi:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                }
                            }
                            else{

                                temp={
                                    name:floating_rate[i].name,
                                    f2f:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                    f2fi:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                }
                            }

                            result.push(temp)
                            mid_one=null;
                            mid_two=null;
                            continue;

                        }



                }
                res.write(JSON.stringify(result)); //write a response
                res.end(); //end the response
            });
        });
        req_floating.end();



    }

    else if(url==="/api_LED_bloom"){
        var result=[];
        var http_floating = require("http");

        var options = {
            "method": "GET",
            "hostname": "bloomforex.com.au",
            "path": "api/LED",
        };

        var req_floating = http_floating.request(options, function (res_floating) {
            var chunks = [];

            res_floating.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res_floating.on("end", function () {
                var content = Buffer.concat(chunks);
                var content_json=JSON.parse(content);
                floating_rate=content_json.rates;

                for(var i=0; i<floating_rate.length;i++){

                    var mid_one=null;
                    var mid_two=null;
                    for(var j=0;j<init_data.length;j++){
                        if(floating_rate[i].name.indexOf("RMB")>=0){
                            floating_rate[i].name="AUD/CNH"
                        }
                        var currencies=floating_rate[i].name.split("/")
                        if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf(currencies[1])>=0){
                            if(init_data[j].name.indexOf(floating_rate[i].name)>=0){
                                var temp={
                                    name:floating_rate[i].name,
                                    f2f: (parseFloat( init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                    f2fi:(parseFloat( init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                }
                                result.push(temp)
                                mid_one=null;
                                mid_two=null;
                                break;
                            }
                            else{
                                var temp={
                                    name:floating_rate[i].name,
                                    f2f:(1/parseFloat(init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                    f2fi:(1/parseFloat(init_data[j].rate)+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                                }
                                result.push(temp)
                                mid_one=null;
                                mid_two=null;
                                break;

                            }
                        }
                        else if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf("USD")>=0){
                            if(init_data[j].name.indexOf(currencies[0])<init_data[j].name.indexOf("USD")){
                                mid_one=parseFloat(init_data[j].rate);
                            }
                            else{
                                mid_one=1/parseFloat(init_data[j].rate)
                            }
                        }
                        else if(init_data[j].name.indexOf(currencies[1])>=0&&init_data[j].name.indexOf("USD")>=0){
                            if(init_data[j].name.indexOf(currencies[1])>init_data[j].name.indexOf("USD")){
                                mid_two=parseFloat(init_data[j].rate);
                            }
                            else{
                                mid_two=1/parseFloat(init_data[j].rate)
                            }
                        }
                    }
                    if(mid_one!=null&&mid_two!=null){
                        var temp;
                        if(floating_rate[i].name.indexOf("CNH")>=0){
                            temp={
                                name:"AUD/RMB",
                                f2f:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                f2fi:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                            }
                        }
                        else{

                            temp={
                                name:floating_rate[i].name,
                                f2f:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer)).toFixed(5),
                                f2fi:(mid_two*mid_one+parseFloat(floating_rate[i].transfer_to_transfer_i)).toFixed(5),
                            }
                        }

                        result.push(temp)
                        mid_one=null;
                        mid_two=null;
                        continue;

                    }

                }
                res.write(JSON.stringify(result)); //write a response
                res.end(); //end the response
            });
        });
        req_floating.end();



    }
    else if(url==="/api/rates"){
        var result=[];
        var http_floating = require("http");

        var options = {
            "method": "GET",
            "hostname": "fast-forex.com.au",
            "path": "api/full_rate_info",
        };

        var req_floating = http_floating.request(options, function (res_floating) {
            var chunks = [];

            res_floating.on("data", function (chunk) {
                chunks.push(chunk);
            });
            res_floating.on("end", function () {
                var content = Buffer.concat(chunks);
                var content_json=JSON.parse(content);
                floating_rate=content_json.rates;

                for(var i=0; i<floating_rate.length;i++){

                    var mid_one=null;
                    var mid_two=null;
                    for(var j=0;j<init_data.length;j++){
                        if(floating_rate[i].name.indexOf("RMB")>=0){
                            floating_rate[i].name=floating_rate[i].name.replace("RMB", "CNH")
                        }
                        var currencies=floating_rate[i].name.split("/")
                        if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf(currencies[1])>=0){
                            if(init_data[j].name.indexOf(floating_rate[i].name)>=0){
                                var temp={
                                    name:floating_rate[i].name,
                                    rate: parseFloat( init_data[j].rate).toFixed(5),
                                }
                                result.push(temp)
                                mid_one=null;
                                mid_two=null;
                                break;
                            }
                            else{
                                var temp={
                                    name:floating_rate[i].name,
                                    rate:(1/parseFloat(init_data[j].rate)).toFixed(5),
                                }
                                result.push(temp)
                                mid_one=null;
                                mid_two=null;
                                break;

                            }
                        }
                        else if(init_data[j].name.indexOf(currencies[0])>=0&&init_data[j].name.indexOf("USD")>=0){
                            if(init_data[j].name.indexOf(currencies[0])<init_data[j].name.indexOf("USD")){
                                mid_one=parseFloat(init_data[j].rate);
                            }
                            else{
                                mid_one=1/parseFloat(init_data[j].rate)
                            }
                        }
                        else if(init_data[j].name.indexOf(currencies[1])>=0&&init_data[j].name.indexOf("USD")>=0){
                            if(init_data[j].name.indexOf(currencies[1])>init_data[j].name.indexOf("USD")){
                                mid_two=parseFloat(init_data[j].rate);
                            }
                            else{
                                mid_two=1/parseFloat(init_data[j].rate)
                            }
                        }
                    }
                    if(mid_one!=null&&mid_two!=null){
                        var temp;
                        temp={
                            name:floating_rate[i].name,
                            rate:(mid_two*mid_one).toFixed(5),
                        }


                        result.push(temp)
                        mid_one=null;
                        mid_two=null;
                        continue;
                    }

                }
                res.write(JSON.stringify(result)); //write a response
                res.end(); //end the response
            });
        });
        req_floating.end();
    }
    else{
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept-Type');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.end('NodeJS server running on Shared Hosting');
    }

});

server.listen(port, hostname, () => {
   // console.log(`Server running at http://${hostname}:${port}/`);
});

var io_server = require('socket.io')(server);

io_server.on('connection', function(socket){
    //fs.writeFileSync("temp.txt","test");
    socket.emit("init",init_data);
    socket.on("direct_load", function(id){
        get_history(id)
    })
    socket.on("indirect_load", function(id){
        var ids=id.split("/");
        get_history_indirectly(ids)
    })

    var get_history=(id)=>{
        var callback=(statusCode,data)=>{
            try {
                var jsonData = JSON.parse(data);
            } catch (e) {
                 console.log( e);
                return;
            }
            if(jsonData.response.executed==true){
                socket.emit('direct_load_reply',jsonData);
            }

        }
        request_processor("GET","/candles/"+id+"/h1",querystring.stringify({ "num":10 }),callback);
    }

    var get_history_indirectly=(ids)=>{
        var response_one;
        var response_two;

        var callback_one=(statusCode,data)=>{
            try {
                var jsonData = JSON.parse(data);
            } catch (e) {
                  console.log( e);
                return;
            }
            if(jsonData.response.executed==true){
                response_one=jsonData
                var callback_two=(statusCode,data)=>{
                    try {
                        var jsonData = JSON.parse(data);
                    } catch (e) {
                           console.log( e);
                        return;
                    }
                    if(jsonData.response.executed==true){
                        response_two=jsonData
                        var result={
                            response_one:response_one,
                            response_two:response_two
                        }
                        //  console.log(result)
                        socket.emit('indirect_load_reply',result);

                    }
                    else{
                        return
                    }

                }
                request_processor("GET","/candles/"+ids[1]+"/h1",querystring.stringify({ "num":10 }),callback_two);
            }
            else{
                return null
            }

        }

        request_processor("GET","/candles/"+ids[0]+"/h1",querystring.stringify({ "num":10 }),callback_one);

    }
});

process.on('uncaughtException', function(err) {


    process.exit();
});

process.on('exit', (code) => {

        if (init_data.length>0) {
            fs.writeFileSync("temp.txt",JSON.stringify(init_data));
        }

});





