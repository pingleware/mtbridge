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
    ccy1history[i] = new RateInfo();
    ccy2history[i] = new RateInfo();
    ccy3history[i] = new RateInfo();
    session[i] = new SESSION();
    trade_commands[i] = new TRADECOMMANDS();
}

for (let i=0; i<100; i++) {
    ticks[i] = new TICKS();
}


// Displays the available routes
app.get("/",cors(), function(req, res, next){
    try {
        const routes = [];

        app._router.stack.forEach(middleware => {
            if (middleware.route) {
                routes.push(`${Object.keys(middleware.route.methods)} -> ${middleware.route.path}`);
            }
        });
        res.json(routes);
    } catch(error) {
        
        next(error);
    }
});

// Displays PACKAGE.JSON information
app.get("/about",cors(), function(req, res, next){
    try {
        var pjson = require('./package.json');
        res.json(pjson);
    } catch(error) {
        
        next(error);
    }
});


// Generates a MD5 hash from a plain text password, hash is saved to SETTINGS.JSON 
app.get('/md5/:password',cors(), function(req, res, next){
    try {
        md5.string.quiet(req.params.password, function (err, md5) {
            if (err) {
                res.json(err);
            }
            else {
                res.json(md5);
            }
        });
    } catch(error) {
        
        next(error);
    }
});

// Shutdowns the server with password authentication
app.get('/shutdown/:password', function (req, res, next) {
    try {
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
    } catch(error) {
        
        next(error);
    }
});

app.get("/ResetAll/:password", cors(), function(req, res, next){
    try {
        if (config.password) {
            md5.string.quiet(req.params.password, function (err, md5){
                if (err) {
                    next(err);
                } else {
                    for(let i=0; i<MAX_SESSIONS; i++) {
                        account[i] = new ACCOUNT();
                        ccypairs[i] = new CCYPAIRS();
                        marketinfo[i] = new MARKETINFO();
                        margininfo[i] = new MARGIN();
                        response[i] = new RESPONSES();
                        history[i] = new RateInfo();
                        ccy1history[i] = new RateInfo();
                        ccy2history[i] = new RateInfo();
                        ccy3history[i] = new RateInfo();
                        session[i] = new SESSION();
                        trade_commands[i] = new TRADECOMMANDS();
                    }
                    
                    for (let i=0; i<100; i++) {
                        ticks[i] = new TICKS();
                    }
                }
            });
        } else {
            res.json("Please set password in settings.json");
        }
    } catch(error) {
        
    } 
});

app.get("/GetMaximumSessions", cors(), function(req, res, next){
    res.json(MAX_SESSIONS);
});

app.get("/FindExistingSession/:acctnum,:handle,:symbol",cors(), function(req, res,next){
    try {
        res.json(FindExistingSession(req.params.acctnum, req.params.handle, req.params.symbol));
    } catch(error) {
        
        next(error);
    }
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
app.get("/Initialize/:acctnum,:handle,:symbol,:symbol1,:symbol2,:symbol3",cors(), function(req, res, next){
    try {
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
    } catch(error) {
        
        next(error);
    }
});

/**
 * const int acctnum,const int handle,const char *symbol
 */
app.get("/InitializeCurrency1/:acctnum,:handle,:symbol",cors(), function(req, res, next){
    try {
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
    } catch(error) {
        
        next(error);
    }
});
/**
 * const int acctnum,const int handle,const char *symbol,const int magic
 */
app.get("/InitializeCurrency2/:acctnum,:handle,:symbol,:magic",cors(), function(req, res, next){
    try {
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
    } catch(error) {
        
        next(error);
    }
});
/**
 * const int acctnum,const int handle,const char *symbol,const int magic
 */
app.get("/InitializeCurrency3/:acctnum,:handle,:symbol,:magic",cors(), function(req, res, next){
    try {
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
    } catch(error) {
        
        next(error);
    }
});
app.get("/DeInitialize/:index",cors(), function(req, res, next){
    try {
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
    } catch(error) {
        
        next(error);
    }
});

app.get("/GetSessionCount",cors(), function(req, res, next){
    res.json(session_count);
});

app.get("/GetSession/:index",cors(), function(req, res, index){
    try {
        if (req.params.index > MAX_SESSIONS || req.params.index > session_count || req.params.index < 0) {
            var temp = new SESSION();
            res.json(temp);
        } else {
            res.json(session[req.params.index-1]);
        }
    } catch(error) {
        
        next(error);
    }
});

app.get("/GetAllSessions",cors(), function(req, res, next){
    res.json(session);
});
app.get("/GetAllAccounts", cors(), function(req, res, next){
    res.json(account);
});
app.get("/GetAllCurrencyPairs", cors(), function(req, res, next){
    res.json(ccypairs);
});
app.get("/GetAllMarketInfo", cors(), function(req, res, next){
    res.json(marketinfo);
});
app.get("/GetAllMarginInfo", cors(), function(req, res, next){
    res.json(margininfo);
});
app.get("/GetAllResponses", cors(), function(req, res, next){
    res.json(response);
});
app.get("/GetAllHistory", cors(), function(req, res, next){
    res.json(history);
});
app.get("/GetAllCurrency1Histpry", cors(), function(req, res, next){
    res.json(ccy1history);
});
app.get("/GetAllCurrency2Histpry", cors(), function(req, res, next){
    res.json(ccy2history);
});
app.get("/GetAllCurrency3Histpry", cors(), function(req, res, next){
    res.json(ccy3history);
});
app.get("/GetAllTradeCommands", cors(), function(req, res, next){
    res.json(trade_commands);
});
app.get("/GetAllPrices", cors(), function(req, res, next){
    res.json({ "bid": bid, "ask": ask, "close": close, "volume": volume});
});

app.get("/GetDllVersion",cors(), function(req, res, next){
    res.json("Metatrader API Version 3.0 - Copyright (c) 2009,2012,2013,2019 PressPage Entertainment Inc DBA RedeeCash");
});
/**
 * int index,double _bid,double _ask,double _close,double _volume)
 */
app.get("/SetBidAsk/:session,:bid,:ask,:close,:volume",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            bid[req.params.session-1] = req.params.bid;
            ask[req.params.session-1] = req.params.ask;
            close[req.params.session-1] = req.params.close;
            volume[req.params.session-1] = req.params.volume;
            
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetBid/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(bid[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetAsk/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(ask[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetVolume/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(volume[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetClose/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(close[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});

app.get("/SaveAccountInfo/:session,:number,:balance,:equity,:leverage",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            account[req.params.session-1].number = req.params.number;
            account[req.params.session-1].balance = req.params.balance;
            account[req.params.session-1].equity = req.params.equity;
            account[req.params.session-1].leverage = req.params.leverage;
        
            res.json(req.params.session);
        }
    } catch(error) {
        
        next(error);
    }
});

app.get("/GetAccountNumber/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(account[req.params.session-1].number);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetAccountBalance/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(account[req.params.session-1].balance);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetAccountEquity/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(account[req.params.session-1].equity);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetAccountLeverage/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(account[req.params.session-1].leverage);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveCurrencySessionInfo/:session,:symbol,:handle,:period,:number",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            ccypairs[req.params.session-1].id = req.params.session;
            ccypairs[req.params.session-1].symbol = req.params.symbol;
            ccypairs[req.params.session-1].handle = req.params.handle;
            ccypairs[req.params.session-1].period = req.params.period;
            ccypairs[req.params.session-1].number = req.params.number;
            res.json(req.params.session);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionCurrency/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(session[req.params.session-1].symbol);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionCurrency1/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(session[req.params.session-1].symbol1);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionCurrency2/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(session[req.params.session-1].symbol2);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionCurrency3/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(session[req.params.session-1].symbol3);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionHandle/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(session[req.params.session-1].handle);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSessionPeriod/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("ERROR");
        } else {
            res.json(ccypairs[req.params.session-1].period);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/DecrementQueuePosition",cors(), function(req, res, next){
    try {
        queue_position[session]--;
        res.json(ERROR_CODES.RET_OK);
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveMarketInfo/:session,:number,:leverage,:symbol,:points,:digits,:spread,:stoplevel",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            marketinfo[req.params.session-1].number = req.params.number;
            marketinfo[req.params.session-1].leverage = req.params.leverage;
            marketinfo[req.params.session-1].symbol = req.params.symbol;
            marketinfo[req.params.session-1].points = req.params.points;
            marketinfo[req.params.session-1].digits = req.params.digits;
            marketinfo[req.params.session-1].spread = req.params.spread;
            marketinfo[req.params.session-1].stoplevel = req.params.stoplevel;
        
            res.json(req.params.session);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetDigits/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(marketinfo[req.params.session-1].digits);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSpread/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(marketinfo[req.params.session-1].spread);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetStoplevel/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(marketinfo[req.params.session-1].stoplevel);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetPoints/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(marketinfo[req.params.session-1].points);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveMarginInfo/:session,:symbol,:handle,:margininit,:marginmaintenance,:marginhedged,:marginrequired,:margincalcmode",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR+CODES.RET_ERROR);
        } else {
            margininfo[req.params.session-1].symbol = req.params.symbol;
            margininfo[req.params.session-1].handle = req.params.handle;
            margininfo[req.params.session-1].margininit = req.params.margininit;
            margininfo[req.params.session-1].marginmaintenance = req.params.marginmaintenance;
            margininfo[req.params.session-1].marginhead = req.params.marginhedged;
            margininfo[req.params.session-1].marginrequired = req.params.marginrequired;
            margininfo[req.params.session-1].margincalcmode = req.params.margincalcmode;
        
            res.json(req.params.session);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetMarginInit/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(margininfo[req.params.session-1].margininit);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetMarginMaintenance/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(margininfo[req.params.session-1].marginmaintenance);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetMarginHedged/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(margininfo[req.params.session-1].marginhedged);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetMarginRequired/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(margininfo[req.params.session-1].marginrequired);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetMarginCalcMode/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            res.json(margininfo[req.params.session-1].margincalcmode);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeOpCommand/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].cmd);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeOpCommand1/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].cmd1);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeOpCommand2/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].cmd2);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeOpCommand3/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].cmd3);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveHistory/:session,:symbol,:rates,:rates_total,:handle",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            for (let i=0;i<100;i++) 
            {
                history[req.params.session-1][i].open = req.params.rates[req.params.rates_total-101+i].open;
                history[req.params.session-1][i].high = req.params.rates[req.params.rates_total-101+i].high;
                history[req.params.session-1][i].low = req.params.rates[req.params.rates_total-101+i].low;
                history[req.params.session-1][i].close = req.params.rates[req.params.rates_total-101+i].close;
                history[req.params.session-1][i].vol = req.params.rates[req.params.rates_total-101+i].vol;
                history[req.params.session-1][i].ctm = req.params.rates[req.params.rates_total-101+i].ctm;
            }
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveHistoryCcy1/:session,:symbol,:rates,:rates_total,:handle",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            for (let i=0;i<100;i++) 
            {
                ccy1history[req.params.session-1][i].open = req.params.rates[req.params.rates_total-101+i].open;
                ccy1history[req.params.session-1][i].high = req.params.rates[req.params.rates_total-101+i].high;
                ccy1history[req.params.session-1][i].low = req.params.rates[req.params.rates_total-101+i].low;
                ccy1history[req.params.session-1][i].close = req.params.rates[req.params.rates_total-101+i].close;
                ccy1history[req.params.session-1][i].vol = req.params.rates[req.params.rates_total-101+i].vol;
                ccy1history[req.params.session-1][i].ctm = req.params.rates[req.params.rates_total-101+i].ctm;
            }
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveHistoryCcy2/:session,:symbol,:rates,:rates_total,:handle",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            for (let i=0;i<100;i++) 
            {
                ccy2history[req.params.session-1][i].open = req.params.rates[req.params.rates_total-101+i].open;
                ccy2history[req.params.session-1][i].high = req.params.rates[req.params.rates_total-101+i].high;
                ccy2history[req.params.session-1][i].low = req.params.rates[req.params.rates_total-101+i].low;
                ccy2history[req.params.session-1][i].close = req.params.rates[req.params.rates_total-101+i].close;
                ccy2history[req.params.session-1][i].vol = req.params.rates[req.params.rates_total-101+i].vol;
                ccy2history[req.params.session-1][i].ctm = req.params.rates[req.params.rates_total-101+i].ctm;
            }
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SaveHistoryCcy3/:session,:symbol,:rates,:rates_total,:handle",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            for (let i=0;i<100;i++) 
            {
                ccy3history[req.params.session-1][i].open = req.params.rates[req.params.rates_total-101+i].open;
                ccy3history[req.params.session-1][i].high = req.params.rates[req.params.rates_total-101+i].high;
                ccy3history[session-1][i].low = req.params.rates[req.params.rates_total-101+i].low;
                ccy3history[req.params.session-1][i].close = req.params.rates[req.params.rates_total-101+i].close;
                ccy3history[req.params.session-1][i].vol = req.params.rates[req.params.rates_total-101+i].vol;
                ccy3history[req.params.session-1][i].ctm = req.params.rates[rates_total-101+i].ctm;
            }
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoryBufferSize/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(100);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalOpen/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].open);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalHigh/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].high);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalLow/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].low);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalClose/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].close);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalVolume/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].volume);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalTime/:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(history[req.params.session-1][req.params.index].ctm);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalOpen2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalHigh2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalLow2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalClose2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalVolume2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/RetrieveHistoricalTime2/:pair,:session,:index",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
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
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SendResponse/:session,:errorcode,:respcode,:message,:ticket",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            response[req.params.session-1].errorcode = req.params.errorcode;
            response[req.params.session-1].respcode = req.params.respcode;
            response[req.params.session-1].tradeid = req.params.ticket;
            response[req.params.session-1].message = req.params.message;
            
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetResponseErrorCode/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(response[req.params.session-1].errorcode);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetResponseCode/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(response[req.params.session-1].respcode);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetResponseMessage/:session",cors(), function(req, res, next){
    try {
        if (session > MAX_SESSIONS || session > session_count || session < 0) {
            res.json("OUT_OF_BOUNDS");
        } else {
            if (response[req.params.session-1].read == 0) {
                response[req.params.session-1].read = -1;
                res.json(response[req.params.session-1].message);
            }
            
            res.json("NONE");
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTicketNumber/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(response[req.params.session-1].tradeid);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SendTradeCommands/:session,:cmd,:symbol,:lots,:price,:stoploss,:profit",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            trade_commands[req.params.session-1].cmd = req.params.cmd;
            trade_commands[req.params.session-1].cmd2 = -1;
            trade_commands[req.params.session-1].cmd3 = -1;
            trade_commands[req.params.session-1].symbol = req.params.symbol;
            trade_commands[req.params.session-1].lots  = req.params.lots;
            trade_commands[req.params.session-1].price = req.params.price;
            trade_commands[req.params.session-1].stoploss = req.params.stoploss;
            trade_commands[req.params.session-1].takeprofit = req.params.profit;
            
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SendTradeCommands2/:session,:cmd,:symbol1,:lots,:cmd2,:symbol2,:lots2,:cmd3,:symbol3,:lots3",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(ERROR_CODES.RET_ERROR);
        } else {
            trade_commands[req.params.session-1].cmd1 = req.params.cmd;
            trade_commands[req.params.session-1].cmd2 = req.params.cmd2;
            trade_commands[req.params.session-1].cmd3 = req.params.cmd3;
            trade_commands[req.params.session-1].symbol1 = req.params.symbol1;
            trade_commands[req.params.session-1].symbol2 = req.params.symbol2;
            trade_commands[req.params.session-1].symbol3 = req.params.symbol3;
            trade_commands[req.params.session-1].lots  = req.params.lots;
            trade_commands[req.params.session-1].lots2  = req.params.lots2;
            trade_commands[req.params.session-1].lots3  = req.params.lots3;
            
            res.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradePrice/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].price);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeLots/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].lots);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeLots2/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].lots2);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeLots3/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].lots3);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeStoploss/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].stoploss);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeTakeprofit/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(trade_commands[req.params.session-1].takeprofit);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/ResetTradeCommand/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            trade_commands[req.params.session-1].cmd = -1;
            trade_commands[req.params.session-1].cmd1 = -1;
            trade_commands[req.params.session-1].cmd2 = -1;
            trade_commands[req.params.session-1].cmd3 = -1;
            req.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeCurrency/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("OUT OF BOUNDS");
        } else {
            res.json(trade_commands[req.params.session-1].symbol);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeCurrency2/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("OUT OF BOUNDS");
        } else {
            res.json(trade_commands[req.params.session-1].symbol2);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetTradeCurrency3/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json("OUT OF BOUNDS");
        } else {
            res.json(trade_commands[req.params.session-1].symbol3);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSwapRateLong/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(swap_rate_long[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/GetSwapRateShort/:session",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            res.json(swap_rate_short[req.params.session-1]);
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SetSwapRateLong/:session,:rate",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            swap_rate_long[req.params.session-1] = req.params.rate;    
            req.json(ERROR_CODES.RET_OK);    
        }
    } catch(error) {
        
        next(error);
    }
});
app.get("/SetSwapRateShort/:session,:rate",cors(), function(req, res, next){
    try {
        if (req.params.session > MAX_SESSIONS || req.params.session > session_count || req.params.session < 0) {
            res.json(-1);
        } else {
            swap_rate_short[req.params.session-1] = req.params.rate;
            req.json(ERROR_CODES.RET_OK);
        }
    } catch(error) {
        
        next(error);
    }
});

var server = app.listen(config.port, () => {
    console.log("Server running on port " + config.port);
});
killable(server);