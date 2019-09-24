"use strict"

var config = require("config.json")("./settings.json");
var md5 = require("nodejs-md5");
var cors = require("cors");
var express = require("express");
var killable = require('killable');
var app = express();

const MAX_SESSIONS=config.max_sessions;

const ERROR_CODES = { 
    RET_OK: 0,
    RET_OK_NONE: 1,
    RET_ERROR: 2,
    RET_INVALID_DATA: 3,
    RET_TECH_PROBLEM: 4,
    RET_ACCOUNT_DISABLED: 5,
    RET_BAD_ACCOUNT_INFO: 6, 

    RET_TIMEOUT: 7,
    RET_BAD_PRICES: 8,
    RET_MARKET_CLOSED: 9,
    RET_TRADE_DISABLE: 10,
    RET_NO_MONEY: 11,
    RET_PRICE_CHANGED: 12,
    RET_OFFQUOTES: 13,
    RET_BROKER_BUSY: 14,

    RET_OLD_VERSION: 15,
    RET_MULTI_CONNECT: 16,
    RET_NO_CONNECT: 17,
    RET_NOT_ENOUGH_RIGHTS: 18,
    RET_BAD_STOPS: 19,
    RET_SKIPPED: 20,
    RET_TOO_FREQUENT: 21,
    RET_INVALID_VOLUME: 22,
    RET_INVALID_HANDLE: 23,
    RET_INSTANTEXECUTION: 24
};

const COMMANDS = { 
    OP_BUY: 0,
    OP_SELL: 1,
    OP_BUY_LIMIT: 2,
    OP_SELL_LIMIT: 3,
    OP_BUY_STOP: 4,
    OP_SELL_STOP: 5,
    OP_BALANCE: 6,
    OP_CREDIT: 7,
    OP_CLOSEPENDING: 8,
    OP_CLOSEALL: 9,
    OP_UNKNOWN: 10
};

class RateInfo {
    constructor() {
        this.ctm = 0;
        this.open = 0;
        this.low = 0;
        this.high = 0;
        this.close = 0;
        this.vol = 0;
    }
};

class SESSION {
    constructor() {
		this.acctnum = 0;
		this.handle = 0;
		this.symbol = "";
		this.symbol1 = "";
		this.symbol2 = "";
		this.symbol3 = "";
		this.index = 0;
		this.magic = 0;
    }
};

class ACCOUNT {
    constructor() {
        this.id = 0; 
        this.number = 0;
        this.balance = 0;
        this.equity = 0;
        this.leverage = 0;    
    }
};

class CCYPAIRS
{
    constructor() {
        this.id = 0;
        this.symbol = "";
        this.handle = 0;
        this.period = 0;
        this.number = 0;    
    }
}; 

class HISTORY
{
    constructor() {
        this.id = 0; 
        this.symbol = ""; 
        this.open = 0;
        this.high = 0;
        this.low = 0;
        this.close = 0;
        this.volume = 0;
        this.ctm = 0;
        this.handle = 0;    
    }
};

class HISTORYMAP
{
    constructor(){
        this.mapfile = null;
        this.name = "";
        this.handle = 0;
        this.size = 0;    
    }
};

class MARGIN
{
    constructor(){
        this.id = 0;
        this.symbol = "";
        this.handle = 0;
        this.margininit = 0;
        this.marginmaintenance = 0;
        this.marginhead = 0;
        this.marginrequired = 0;
        this.margincalcmode = 0;
    }
};

class MARKETINFO
{
    constructor(){
        this.id = 0;
        this.number = 0;
        this.symbol = "";
        this.points = 0;
        this.digits = 0;
        this.spread = 0;
        this.stoplevel = 0;
        this.lotsize = 0;
        this.tickvalue = 0;
        this.ticksize = 0;
        this.swaplong = 0;
        this.swapshort = 0;
        this.profitcalcmode = 0;
        this.freezelevel = 0;
        this.leverage = 0;
    }
};

class RESPONSES
{
    constructor(){
        this.id = 0;
        this.symbol = "";
        this.handle = 0;
        this.message = "";
        this.errorcode = 0;
        this.respcode = 0;
        this.read = 0;
        this.timestamp = "";
        this.tradeid = 0;
    }
}; 

class TICKS
{
    constructor(){
        this.id = 0;
        this.symbol = "";
        this.margin = 0;
        this.freemargin = 0;
        this.tickdate = "";
        this.ask = 0;
        this.bid = 0;
        this.equity = 0;
    }
};

class TRADECOMMANDS
{
    constructor() {
        this.id = 0;
        this.symbol = "";
        this.symbol1 = "";
        this.symbol2 = "";
        this.symbol3 = "";
        this.cmd = 0;
        this.cmd1 = 0;
        this.cmd2 = 0;
        this.cmd3 = 0;
        this.lots = 0;
        this.lots2 = 0;
        this.lots3 = 0;
        this.price = 0;
        this.slippage = 0;
        this.comment = "";
        this.color = 0;
        this.timestamp = "";
        this.completed = 0;
        this.handle = 0;
        this.magic = 0;
        this.expiration = "";
        this.stoploss = 0;
        this.takeprofit = 0;
        this.volume = 0;
        this.ticket = 0;
    }
};

let session_count = 0;
let queue_position = Array(MAX_SESSIONS);

let	bid = Array(MAX_SESSIONS);
let	ask = Array(MAX_SESSIONS);
let	close = Array(MAX_SESSIONS);
let	volume = Array(MAX_SESSIONS);
let swap_rate_long = Array(MAX_SESSIONS);
let swap_rate_short = Array(MAX_SESSIONS);

var account = Array(MAX_SESSIONS); // ACCOUNT
var ccypairs = Array(MAX_SESSIONS); // CCYPAIRS
var marketinfo = Array(MAX_SESSIONS); // MARKETINFO
var margininfo = Array(MAX_SESSIONS); // MARGIN
var trade_commands = Array(MAX_SESSIONS); // TRADECOMMANDS
var response = Array(MAX_SESSIONS); // RESPONSES
var ticks = Array(100); // TICKS
var session = Array(MAX_SESSIONS); // SESSION
var hHistory = Array(MAX_SESSIONS); // HANDLE
var history_count = Array(MAX_SESSIONS);   

var history = Array(MAX_SESSIONS); // RateInfo
var ccy1history = Array(MAX_SESSIONS); // RateInfo
var ccy2history = Array(MAX_SESSIONS); // RateInfo
var ccy3history = Array(MAX_SESSIONS); // RateInfo

// Initialze session variable
for(let i=0; i<MAX_SESSIONS; i++) {
    account[i] = new ACCOUNT();
    ccypairs[i] = new CCYPAIRS();
    marketinfo[i] = new MARKETINFO();
    margininfo[i] = new MARGIN();
    response[i] = new RESPONSES();
    history[i] = new RateInfo();
    ccy1history = new RateInfo();
    ccy2history = new RateInfo();
    ccy3history = new RateInfo();
    session[i] = new SESSION();
    trade_commands[i] = new TRADECOMMANDS();
}

for (let i=0; i<100; i++) {
    ticks[i] = new TICKS();
}


// Displays the available routes
app.get("/",cors(), function(req, res, next){
    const routes = [];

    app._router.stack.forEach(middleware => {
    if (middleware.route) {
        routes.push(`${Object.keys(middleware.route.methods)} -> ${middleware.route.path}`);
    }
    });
    res.json(routes);
});

// Displays PACKAGE.JSON information
app.get("/about",cors(), function(req, res, next){
    var pjson = require('./package.json');
    res.json(pjson);
});


// Generates a MD5 hash from a plain text password, hash is saved to SETTINGS.JSON 
app.get('/md5/:password',cors(), function(req, res, next){
    md5.string.quiet(req.params.password, function (err, md5) {
        if (err) {
            res.json(err);
        }
        else {
            res.json(md5);
        }
    });
    
});

// Shutdowns the server with password authentication
app.get('/shutdown/:password', function (req, res, next) {
    if (config.password) {
        md5.string.quiet(req.params.password, function (err, md5) {
            if (err) {
                next(err);
            }
            else {
                if (md5 === config.password) {
                    res.json('Server is going down NOW!');
  
                    server.kill(function () {
                      //the server is down when this is called. That won't take long.
                    });                
                } else {
                    res.json("Unauthorized access!");
                }
            }
        });
    } else {
        res.json("Please set password in settings.json");
    }
});

//Create new Tick
app.post('/Ticks',cors(), function(req, res) {
    console.log('Inserting New Tick');

    var tick = req.body;
    console.log('>'+JSON.stringify(tick,null,4));

    Tick.addTick(tick, function(err, tick){
        if(err) res.json(err);
        res.json(tick);
    });
});

app.get("/FindExistingSession/:acctnum.:handle.:symbol",cors(), function(req, res,next){
    res.json(FindExistingSession(req.params.acctnum, req.params.handle, req.params.symbol));
});

function FindExistingSession(acctnum,handle,symbol) {
    let found = 0;

    for (let i=0; i<MAX_SESSIONS; i++) {
        if (session[i].acctnum == acctnum &&
            session[i].handle == handle &&
            session[i].symbol === symbol) {
                found = i;
        }
    }

    return found;
}
/**
 * const int acctnum,const int handle,const char *symbol,
									const char *symbol1,const char *symbol2,const char *symbol3
 */
app.get("/Initialize/:acctnum.:handle.:symbol.:symbol1.:symbol2.:symbol3",cors(), function(req, res, next){
    for (let i=0;i<MAX_SESSIONS;i++) {
        if (session[i].index == 0 || (session[i].acctnum == req.params.acctnum && session[i].handle == req.params.handle)) {
            session[i].index = i+1;
            session[i].acctnum = req.params.acctnum;
            session[i].handle = req.params.handle;
            session[i].symbol = req.params.symbol;
            session[i].symbol1 = req.params.symbol1;
            session[i].symbol2 = req.params.symbol2;
            session[i].symbol3 = req.params.symbol3;
            session_count++;
            trade_commands[i].cmd = COMMANDS.OP_UNKNOWN;
            queue_position[i] = 0;
            res.json(i+1);
            break;
        }
    }
});

/**
 * const int acctnum,const int handle,const char *symbol
 */
app.get("/InitializeCurrency1/:acctnum.:handle.:symbol",cors(), function(req, res, next){
    for (let i=0;i<MAX_SESSIONS;i++) {
		if (session[i].index == 0) {
			session[i].index = i+1;
			session[i].acctnum = req.params.acctnum;
			session[i].handle = req.params.handle;
			session[i].symbol1 = req.params.symbol;
			session_count++;
			trade_commands[i].cmd1 = -1;
			trade_commands[i].cmd2 = -1;
			trade_commands[i].cmd3 = -1;
			queue_position[i] = 0;

			session[i].magic = Math.random();

			res.json(i+1);
		}
    }
});
/**
 * const int acctnum,const int handle,const char *symbol,const int magic
 */
app.get("/InitializeCurrency2/:acctnum.:handle.:symbol.:magic",cors(), function(req, res, next){
    let result = -1;

    if (!req.params.magic) {
        res.json(result);
    } else {
        for (let i=0;i<MAX_SESSIONS;i++) {
            if (session[i].magic == req.params.magic) {
                session[i].symbol2 = req.params.symbol;
                result = i+1;
            }
        }
        res.json(result);
    }
});
/**
 * const int acctnum,const int handle,const char *symbol,const int magic
 */
app.get("/InitializeCurrency3/:acctnum.:handle.:symbol.:magic",cors(), function(req, res, next){
    let result = -1;

    if (!req.params.magic) {
        res.json(result);
    } else {
        for (let i=0;i<MAX_SESSIONS;i++) {
            if (session[i].magic == magic) {
                session[i].symbol3 = req.params.symbol;
                result = i+1;
            }
        }

        res.json(result);
    }
});
app.get("/DeInitialize/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) {
        res.json(ERROR_CODES.RET_ERROR);
    } else {
        session[index-1].index = 0;
        session[index-1].acctnum = 0;
        session[index-1].handle = 0;
        session[index-1].symbol = "0";
        trade_commands[index-1].cmd = COMMANDS.OP_UNKNOWN;
        queue_position[index-1] = 0;
    
        if (session_count > 0) session_count--;
    
        res.json(ERROR_CODES.RET_OK);    
    }

});

app.get("/GetSessionCount",cors(), function(req, res, next){
    res.json(session_count);
});

app.get("/GetSession/:index",cors(), function(req, res, index){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) 
	{
		var temp = new SESSION();
		res.json(temp);
	}
	res.json(session[req.params.index-1]);
});

app.get("/GetAllSessions",cors(), function(req, res, next){
    res.json(session);
});
app.get("/GetDllVersion",cors(), function(req, res, next){
    res.json("Metatrader API Version 3.0 - Copyright (c) 2009,2012,2013,2019 PressPage Entertainment Inc DBA RedeeCash");
});
/**
 * int index,double _bid,double _ask,double _close,double _volume)
 */
app.get("/SetBidAsk",cors(), function(req, res, next){
    let index = req.params.index;
    let _bid = req.params.bid;
    let _ask = req.params.ask;
    let _close = req.params.close;
    let _volume = req.params.volume;

    if (index > MAX_SESSIONS || index > session_count || index < 0) {
        res.json(ERROR_CODES.RET_ERROR);
    } else {
        bid[index-1] = _bid;
        ask[index-1] = _ask;
        close[index-1] = _close;
        volume[index-1] = _volume;
        
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/GetBid/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json(-1);
	res.json(bid[req.params.index-1]);
});
app.get("/GetAsk/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json(-1);
	res.json(ask[req.params.index-1]);
});
app.get("/GetVolume/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json(-1);
	res.json(volume[req.params.index-1]);
});
app.get("/GetClose/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json(-1);
	res.json(close[req.params.index-1]);
});

app.get("/SaveAccountInfo/:session.:acctnum.:balance.:equity.:leverage",cors(), function(req, res, next){
    let session = req.params.session;
    let number = req.params.acctnum;
    let balance = req.params.balance;
    let equity = req.params.equity;
    let leverage = req.params.leverage;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(ERROR_CODES.RET_ERROR);
    } else {
        account[session-1].number = number;
        account[session-1].balance = balance;
        account[session-1].equity = equity;
        account[session-1].leverage = leverage;
    
        res.json(session);
    }
});

app.get("/GetAccountNumber/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(account[session-1].number);
});
app.get("/GetAccountBalance/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(account[session-1].balance);
});
app.get("/GetAccountEquity/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(account[session-1].equity);
});
app.get("/GetAccountLeverage/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(account[session-1].leverage);
});
app.get("/SaveCurrencySessionInfo/:session.:symbol.:handle.:period.:number",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    let handle = req.params.handle;
    let period = req.params.period;
    let number = req.params.number;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(ERROR_CODES.RET_ERROR);
    } else {
        ccypairs[session-1].id = session;
        ccypairs[session-1].symbol = symbol;
        ccypairs[session-1].handle = handle;
        ccypairs[session-1].period = period;
        ccypairs[session-1].number = number;
        res.json(session);
    }
});
app.get("/GetSessionCurrency/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(session[req.params.index-1].symbol);
});
app.get("/GetSessionCurrency1/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(session[req.params.index-1].symbol1);
});
app.get("/GetSessionCurrency2/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(session[req.params.index-1].symbol2);
});
app.get("/GetSessionCurrency3/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(session[req.params.index-1].symbol3);
});
app.get("/GetSessionHandle/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(session[req.params.index-1].handle);
});
app.get("/GetSessionPeriod/:index",cors(), function(req, res, next){
    if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) res.json("ERROR");
    res.json(ccypairs[session-1].period);
});
app.get("/DecrementQueuePosition",cors(), function(req, res, next){
    queue_position[session]--;
	res.json(ERROR_CODES.RET_OK);
});
app.get("/SaveMarketInfo/:session.:number.:leverage.:symbol.:points.:digits.:spread.:stoplevel",cors(), function(req, res, next){
    let session = req.params.session;
    let number = req.params.number;
    let leverage = req.params.leverage;
    var symbol = req.params.symbol;
    let points = req.params.points;
    let digits = req.params.digits;
    let spread = req.params.spread;
    let stoplevel = req.params.stoplevel;

    marketinfo[session-1].number = number;
    marketinfo[session-1].leverage = leverage;
    marketinfo[session-1].symbol = symbol;
    marketinfo[session-1].points = points;
    marketinfo[session-1].digits = digits;
    marketinfo[session-1].spread = spread;
    marketinfo[session-1].stoplevel = stoplevel;

    res.json(session);
});
app.get("/GetDigits/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
    res.json(marketinfo[session-1].digits);
});
app.get("/GetSpread/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
    res.json(marketinfo[session-1].spread);
heather97
});
app.get("/GetStoplevel/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
    res.json(marketinfo[session-1].stoplevel);
});
app.get("/GetPoints/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
    res.json(marketinfo[session-1].points);
});
app.get("/SaveMarginInfo/:session.:symbol.:handle.:margininit.:marginmaintenance.:marginhedged.:marginrequired.:margincalcmode",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    let handle = req.params.handle;
    let margininit = req.params.margininit;
	let marginmaintenance = req.params.marginmaintenance;
    let marginhedged = req.params.marginhedged;
    let marginrequired = req.params.marginrequired;
    let margincalcmode = req.params.margincalcmode;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(ERROR+CODES.RET_ERROR);
    } else {
        margininfo[session-1].symbol = symbol;
        margininfo[session-1].handle = handle;
        margininfo[session-1].margininit = margininit;
        margininfo[session-1].marginmaintenance = marginmaintenance;
        margininfo[session-1].marginhead = marginhedged;
        margininfo[session-1].marginrequired = marginrequired;
        margininfo[session-1].margincalcmode = margincalcmode;
    
        res.json(session);
    }
});
app.get("/GetMarginInit/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(margininfo[req.params.session-1].margininit);
});
app.get("/GetMarginMaintenance/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(margininfo[req.params.session-1].marginmaintenance);
});
app.get("/GetMarginHedged/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(margininfo[req.params.session-1].marginhedged);
});
app.get("/GetMarginRequired/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(margininfo[req.params.session-1].marginrequired);
});
app.get("/GetMarginCalcMode/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(ERROR_CODES.RET_ERROR);
	res.json(margininfo[req.params.session-1].margincalcmode);
});
app.get("/GetTradeOpCommand/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].cmd);
});
app.get("/GetTradeOpCommand1/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].cmd1);
});
app.get("/GetTradeOpCommand2/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].cmd2);
});
app.get("/GetTradeOpCommand3/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].cmd3);
});
app.get("/SaveHistory/:session.:symbol.:rates.:rates_total.:handle",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    var rates = req.params.rates; // RateInfo
    let rates_total = req.params.rates_total;
    let handle = req.params.handle;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(-1);
    } else {
        for (let i=0;i<100;i++) 
        {
            history[session-1][i].open = rates[rates_total-101+i].open;
            history[session-1][i].high = rates[rates_total-101+i].high;
            history[session-1][i].low = rates[rates_total-101+i].low;
            history[session-1][i].close = rates[rates_total-101+i].close;
            history[session-1][i].vol = rates[rates_total-101+i].vol;
            history[session-1][i].ctm = rates[rates_total-101+i].ctm;
        }
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/SaveHistoryCcy1/:session.:symbol.:rates.:rates_total.:handle",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    var rates = req.params.rates; // RateInfo
    let rates_total = req.params.rates_total;
    let handle = req.params.handle;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(-1);
    } else {
        for (let i=0;i<100;i++) 
        {
            ccy1history[session-1][i].open = rates[rates_total-101+i].open;
            ccy1history[session-1][i].high = rates[rates_total-101+i].high;
            ccy1history[session-1][i].low = rates[rates_total-101+i].low;
            ccy1history[session-1][i].close = rates[rates_total-101+i].close;
            ccy1history[session-1][i].vol = rates[rates_total-101+i].vol;
            ccy1history[session-1][i].ctm = rates[rates_total-101+i].ctm;
        }
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/SaveHistoryCcy2/:session.:symbol.:rates.:rates_total.:handle",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    var rates = req.params.rates; // RateInfo
    let rates_total = req.params.rates_total;
    let handle = req.params.handle;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(-1);
    } else {
        for (let i=0;i<100;i++) 
        {
            ccy2history[session-1][i].open = rates[rates_total-101+i].open;
            ccy2history[session-1][i].high = rates[rates_total-101+i].high;
            ccy2history[session-1][i].low = rates[rates_total-101+i].low;
            ccy2history[session-1][i].close = rates[rates_total-101+i].close;
            ccy2history[session-1][i].vol = rates[rates_total-101+i].vol;
            ccy2history[session-1][i].ctm = rates[rates_total-101+i].ctm;
        }
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/SaveHistoryCcy3/:session.:symbol.:rates.:rates_total.:handle",cors(), function(req, res, next){
    let session = req.params.session;
    var symbol = req.params.symbol;
    var rates = req.params.rates; // RateInfo
    let rates_total = req.params.rates_total;
    let handle = req.params.handle;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(-1);
    } else {
        for (let i=0;i<100;i++) 
        {
            ccy3history[session-1][i].open = rates[rates_total-101+i].open;
            ccy3history[session-1][i].high = rates[rates_total-101+i].high;
            ccy3history[session-1][i].low = rates[rates_total-101+i].low;
            ccy3history[session-1][i].close = rates[rates_total-101+i].close;
            ccy3history[session-1][i].vol = rates[rates_total-101+i].vol;
            ccy3history[session-1][i].ctm = rates[rates_total-101+i].ctm;
        }
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/RetrieveHistoryBufferSize/:session",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(100);
});
app.get("/RetrieveHistoricalOpen/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].open);
});
app.get("/RetrieveHistoricalHigh/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].high);
});
app.get("/RetrieveHistoricalLow/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].low);
});
app.get("/RetrieveHistoricalClose/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].close);
});
app.get("/RetrieveHistoricalVolume/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].volume);
});
app.get("/RetrieveHistoricalTime/:session.:index",cors(), function(req, res, next){
    if (req.parsms.session > MAX_SESSIONS || req.parsms.session > session_count || req.parsms.session < 0) res.json(-1);
	res.json(history[req.parsms.session-1][req.parsms.index].ctm);
});
app.get("/RetrieveHistoricalOpen2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].open);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].open);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].open);
			break;
	}
	res.json(0);
});
app.get("/RetrieveHistoricalHigh2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].high);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].high);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].high);
			break;
	}
	res.json(0);
});
app.get("/RetrieveHistoricalLow2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].low);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].low);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].low);
			break;
	}
	res.json(0);
});
app.get("/RetrieveHistoricalClose2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].close);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].close);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].close);
			break;
	}
	res.json(0);
});
app.get("/RetrieveHistoricalVolume2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].vol);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].vol);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].vol);
			break;
	}
	res.json(0);
});
app.get("/RetrieveHistoricalTime2/:pair.:session.:index",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	switch(req.params.pair-1) {
		case 0:
			res.json(ccy1history[req.params.session-1][req.params.index].ctm);
			break;
		case 1:
			res.json(ccy2history[req.params.session-1][req.params.index].ctm);
			break;
		case 2:
			res.json(ccy3history[req.params.session-1][req.params.index].ctm);
			break;
	}
	res.json(0);
});
app.get("/SendResponse/:session.:errorcode.:respcode.:message.:ticket",cors(), function(req, res, next){
    let session = req.params.session;
    let errorcode = req.params.errorcode;
    let respcode = req.params.respcode;
    var message = req.params.message;
    let ticket = req.params.ticket;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(-1);
    } else {
        response[session-1].errorcode = errorcode;
        response[session-1].respcode = respcode;
        response[session-1].tradeid = ticket;
        response[session-1].message = message;
        
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/GetResponseErrorCode/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(response[req.params.session-1].errorcode);
});
app.get("/GetResponseCode/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(response[req.params.session-1].respcode);
});
app.get("/GetResponseMessage/:session",cors(), function(req, res, next){
    if (session > MAX_SESSIONS || session > session_count || session < 0) res.json("OUT_OF_BOUNDS");

	if (response[req.params.session-1].read == 0) {
		response[req.params.session-1].read = -1;
		res.json(response[req.params.session-1].message);
    }
    
	res.json("NONE");
});
app.get("/GetTicketNumber/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(response[req.params.session-1].tradeid);
});
app.get("/SendTradeCommands/:session.:cmd.:symbol.:lots.:price.:stoploss.:profit",cors(), function(req, res, next){
    let session = req.params.session;
    let cmd = req.params.cmd;
    var symbol = req.params.symbol;
    let lots = req.params.lots;
    let price = req.params.price;
    let stoploss = req.params.stoploss;
    let profit = req.params.profit;

    if (session > MAX_SESSIONS || session > session_count || session < 0) {
        res.json(ERROR_CODES.RET_ERROR);
    } else {
        trade_commands[session-1].cmd = cmd;
        trade_commands[session-1].cmd2 = -1;
        trade_commands[session-1].cmd3 = -1;
        trade_commands[session-1].symbol = symbol;
        trade_commands[session-1].lots  = lots;
        trade_commands[session-1].price = price;
        trade_commands[session-1].stoploss = stoploss;
        trade_commands[session-1].takeprofit = profit;
        
        res.json(ERROR_CODES.RET_OK);
    }
});
app.get("/SendTradeCommands2/:session.:cmd.:symbol1.:lots.:cmd2.:symbol2.:lots2.:cmd3.:symbol3.:lots3",cors(), function(req, res, next){
    let session = req.params.session;
    let cmd = req.params.cmd;
    var symbol1 = req.params.symbol1;
    let lots = req.params.lots;
    let cmd2 = req.params.cmd2;
    var symbol2 = req.params.symbol2;
    let lots2 = req.params.lots2;
    let cmd3 = req.params.cmd3;
    var symbol3 = req.params.symbol3;
    let lots3 = req.params.lots3;

    trade_commands[session-1].cmd1 = cmd;
	trade_commands[session-1].cmd2 = cmd2;
	trade_commands[session-1].cmd3 = cmd3;
	trade_commands[session-1].symbol1 = symbol1;
	trade_commands[session-1].symbol2 = symbol2;
	trade_commands[session-1].symbol3 = symbol3;
	trade_commands[session-1].lots  = lots;
	trade_commands[session-1].lots2  = lots2;
	trade_commands[session-1].lots3  = lots3;
    
    res.json(ERROR_CODES.RET_OK);
});
app.get("/GetTradePrice/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].price);
});
app.get("/GetTradeLots/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].lots);
});
app.get("/GetTradeLots2/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].lots2);
});
app.get("/GetTradeLots3/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].lots3);
});
app.get("/GetTradeStoploss/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].stoploss);
});
app.get("/GetTradeTakeprofit/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(trade_commands[req.params.session-1].takeprofit);
});
app.get("/ResetTradeCommand/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	trade_commands[req.params.session-1].cmd = -1;
	trade_commands[req.params.session-1].cmd1 = -1;
	trade_commands[req.params.session-1].cmd2 = -1;
    trade_commands[req.params.session-1].cmd3 = -1;
    req.json(ERROR_CODES.RET_OK);
});
app.get("/GetTradeCurrency/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json("OUT OF BOUNDS");
	res.json(trade_commands[req.params.session-1].symbol);
});
app.get("/GetTradeCurrency2/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json("OUT OF BOUNDS");
	res.json(trade_commands[req.params.session-1].symbol2);
});
app.get("/GetTradeCurrency3/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json("OUT OF BOUNDS");
	res.json(trade_commands[req.params.session-1].symbol3);
});
app.get("/GetSwapRateLong/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(swap_rate_long[req.params.session-1]);
});
app.get("/GetSwapRateShort/:session",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) res.json(-1);
	res.json(swap_rate_short[req.params.session-1]);
});
app.get("/SetSwapRateLong/:session.:rate",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
        res.json(-1);
    } else {
        swap_rate_long[req.params.session-1] = req.params.rate;    
        req.json(ERROR_CODES.RET_OK);    
    }
});
app.get("/SetSwapRateShort/:session.:rate",cors(), function(req, res, next){
    if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
        res.json(-1);
    } else {
        swap_rate_short[req.params.session-1] = req.params.rate;
        req.json(ERROR_CODES.RET_OK);
    }
});

var server = app.listen(config.port, () => {
    console.log("Server running on port " + config.port);
});
killable(server);