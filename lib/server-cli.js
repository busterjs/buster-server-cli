var http = require("http");
var path = require("path");
var paperboy = require("paperboy");
var testServer = require("./middleware");
var cli = require("buster-cli");
var DOCUMENT_ROOT = path.join(__dirname, "../public");

function servePublicFiles(documentRoot, req, res) {
    paperboy
        .deliver(documentRoot, req, res)
        .addHeader("Expires", 300)
        .error(function (statCode, msg) {
            res.writeHead(statCode, { "Content-Type": "text/plain" });
            res.end("Error " + statCode);
        })
        .otherwise(function (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Error 404: File not found");
        });
}

function ServerCli(cli, logger, options) {
    this.cli = cli;
    this.logger = logger;
    this.documentRoot = options.documentRoot || DOCUMENT_ROOT;
    this.templateRoot = options.templateRoot;
    this.name = options.name;
    this.binary = options.binary;
    this.unexpectedErrorMessage = options.unexpectedErrorMessage;
    this.phantom = options.phantom || require("phantom-proxy");
}

module.exports = ServerCli.prototype = {
    create: function (stdout, stderr, options) {
        var c = cli.create(options);
        c.addHelpOption(options.missionStatement, options.description);
        return new ServerCli(c, c.createLogger(stdout, stderr), options || {});
    },

    run: function (args, callback) {

        callback = callback || function () {};
        this.loadOptions();
        this.cli.parseArgs(args, function (err, options) {
            if (this.cli.loggedHelp) { return callback(); }
            try {
                var port = options["--port"].value;
                var binding = options["--binding"].value;
                var server = this.createServer(port, binding, function (err) {
                    if (err) {
                        this.handleError(err);
                        return callback(err);
                    }

                    var serverUrl = "http://localhost:" + port;
                    this.logger.log(this.binary + " running on " + serverUrl);
                    if (options['--capture-headless'].isSet) {
                        this.captureHeadlessBrowser(serverUrl, function () {
                            callback(null, server);
                        }.bind(this));
                    } else {
                        callback(null, server);
                    }
                }.bind(this));
            } catch (e) {
                this.handleError(e);
                callback(e);
            }
        }.bind(this));
    },

    createServer: function (port, binding, callback) {
        var middleware, documentRoot = this.documentRoot;
        var httpServer = http.createServer(function (req, res) {
            if (middleware.respond(req, res)) { return; }
            servePublicFiles(documentRoot, req, res);
        });
        middleware = testServer.create(httpServer, {
            logger: this.logger,
            templateRoot: this.templateRoot,
            name: this.name
        });
        httpServer.on("error", this.handleError.bind(this));
        httpServer.listen(port, binding, callback);
        return httpServer;
    },

    captureHeadlessBrowser: function (serverUrl, sessionId, cb) {
        this.logger.log('Starting headless browser...');
        if (cb === undefined && typeof sessionId === 'function') {
            cb = sessionId;
            sessionId = undefined;
        }
        var url = serverUrl + '/capture';
        if (sessionId !== undefined) {
            url += '?id=' + sessionId;
        }
        this.phantom.create(function (proxy) {
            proxy.page.open(url, function (success) {
                if (success) {
                    this.logger.log('Headless browser was captured.');
                } else {
                    this.logger.log(
                        'Headless browser was not captured. Something went wrong :-('
                    );
                }
                cb && cb();
            }.bind(this));
        }.bind(this));
    },

    loadOptions: function () {
        this.cli.opt(["-p", "--port"], {
            description: "The port to run the server on",
            defaultValue: 1111,
            validators: [this.cli.validators.integer()],
            transform: function (value) { return parseInt(value, 10); }
        });

        this.cli.opt(["-b", "--binding"], {
            description: "The address to bind the server to",
            hasValue: true
        });

        this.cli.opt(['-c', '--capture-headless'], {
            description: "Captures a headless webkit browser " +
                "after the server was started."
        });
    },

    handleError: function (err) {
        if (/EADDRINUSE/.test(err.message)) {
            this.cli.err("Address already in use. Pick another " +
                         "port with -p/--port to start " + this.binary);
        } else {
            this.cli.err(this.unexpectedErrorMessage + err.stack);
        }
    }
};
