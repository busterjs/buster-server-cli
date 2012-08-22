var http          = require("http");
var path          = require("path");
var paperboy      = require("paperboy");
var B             = require("buster-core");
var testServer    = require("./middleware");
var cli           = require("buster-cli");
var DOCUMENT_ROOT = path.join(__dirname, "../public");

function servePublicFiles(documentRoot, req, res) {
    paperboy
        .deliver(documentRoot, req, res)
        .addHeader("Expires", 300)
        .error(function(statCode, msg) {
            res.writeHead(statCode, { "Content-Type": "text/plain" });
            res.end("Error " + statCode);
        })
        .otherwise(function(err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Error 404: File not found");
        });
}

module.exports = {
    create: function (stdout, stderr, options) {
        options = options || {};

        var c = cli.create(options);
        var logger = c.createLogger(stdout, stderr);

        c.addHelpOption(options.missionStatement, options.description);

        return B.extend(B.create(this), {
            cli: c,
            logger: logger,
            documentRoot: options.documentRoot || DOCUMENT_ROOT,
            templateRoot: options.templateRoot,
            name: options.name,
            binary: options.binary,
            unexpectedErrorMessage: options.unexpectedErrorMessage,
            phantom: options.phantom || require('phantom')
        });
    },

    run: function (args, callback) {
        callback = callback || function () {};

        this.loadOptions();
        this.cli.parseArgs(args, function (err, options) {
            if (this.cli.loggedHelp) {
                return callback();
            }

            try {
                var port = options["--port"].value;
                var binding = options["--binding"].value;
                var server = this.createServer(port, binding);

                process.nextTick(function () {
                    var serverUrl = "http://localhost:" + port;

                    if(options['--capture-headless'].isSet) {
                        this.captureHeadlessBrowser(serverUrl);
                    }

                    callback(null, server);

                    this.logger.log(this.binary + " running on " + serverUrl);
                }.bind(this));
            } catch (e) {
                this.handleError(e);
                callback(e);
            }
        }.bind(this));
    },

    createServer: function (port, binding) {
        var middleware, documentRoot = this.documentRoot;
        var httpServer = http.createServer(function (req, res) {
            if (middleware.respond(req, res)) { return; }
            servePublicFiles(documentRoot, req, res);
        });
        httpServer.on("error", B.bind(this, "handleError"));
        httpServer.listen(port, binding);
        middleware = testServer.create(httpServer, {
            logger: this.logger,
            templateRoot: this.templateRoot,
            name: this.name
        });
        return httpServer;
    },

    captureHeadlessBrowser: function(serverUrl) {
        var self = this;

        this.logger.log('Starting headless browser...');
        this.phantom.create(function(ph) {
            ph.createPage(function(page) {
                page.open(serverUrl + '/capture');
                self.logger.log('Browser was captured.');
            });
        });
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
            description: "Captures a headless webkit browser after the server was started."
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
