/* global require, process*/
"use strict";

var helper = require("./test-helper").requestHelperFor("localhost", "9999");
var cliHelper = require("buster-cli/test/test-helper");
var http = require("http");
var bane = require("bane");
var buster = require("buster-node");
var assert = buster.assert;
var refute = buster.refute;
var serverCli = require("../lib/server-cli");
var testServer = require("../lib/middleware");
var createServerFunc = function (port, binding, callback) {
    callback(null);
};

buster.testCase("buster-server binary", {
    setUp: function () {
        this.stub(process, "exit");
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.cli = serverCli.create(this.stdout, this.stderr, {
            missionStatement: "Server for automating",
            binary: "buster-server"
        });
    },

    tearDown: function (done) {
        cliHelper.clearFixtures(done);
    },

    "run": {
        "prints to stderr if option handling fails": function (done) {
            helper.run(this, ["--hey"], done(function (err, server) {
                refute.stderr(/^$/);
            }));
        },

        "prints help message": function (done) {
            helper.run(this, ["--help"], done(function () {
                assert.stdout("Server for automating");
                assert.stdout("-h/--help");
                assert.stdout("-p/--port");
            }));
        },

        "starts server on default port": function (done) {
            var createServer = this.stub(this.cli, "createServer",
                createServerFunc);
            helper.run(this, [], done(function (err, server) {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 1111);
            }));
        },

        "starts server on specified port": function (done) {
            var createServer = this.stub(this.cli, "createServer",
                createServerFunc);
            helper.run(this, ["-p", "3200"], done(function () {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 3200);
            }));
        },

        "prints message if address is already in use": function (done) {
            var error = new Error("EADDRINUSE, Address already in use");
            this.stub(this.cli, "createServer").throws(error);
            helper.run(this, ["-p", "3200"], done(function () {
                assert.stderr("Address already in use. Pick another " +
                              "port with -p/--port to start buster-server");
            }));
        },

        "prints message if address is already in use (async)": function (done) {
            var error = new Error("EADDRINUSE, Address already in use");
            var server = bane.createEventEmitter();
            server.listen = this.spy(function (port, binding, callback) {
                callback(error);
            });
            this.stub(http, "createServer").returns(server);
            this.stub(testServer, "create");

            helper.run(this, ["-p", "3200"], done(function () {
                assert.stderr("Address already in use. Pick another " +
                              "port with -p/--port to start buster-server");
            }.bind(this)));
        },

        "binds to specified address": function (done) {
            var createServer = this.stub(this.cli, "createServer",
                createServerFunc);
            helper.run(this, ["-b", "0.0.0.0"], done(function () {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 1111, "0.0.0.0");
            }));
        },

        "binds to undefined when address not specified": function (done) {
            var createServer = this.stub(this.cli, "createServer",
                createServerFunc);
            helper.run(this, [], done(function () {
                assert.calledOnce(createServer);
                assert.calledWith(createServer, 1111, undefined);
            }));
        },

        "captures headless browser if -c was passed":
            function () {
                var createServer = this.stub(this.cli, "createServer",
                    createServerFunc);
                var captureHeadlessBrowser = this.stub(this.cli,
                    "captureHeadlessBrowser");

                helper.run(this, ["-c"]);

                assert.calledOnce(captureHeadlessBrowser);
                assert.calledWithExactly(captureHeadlessBrowser,
                    "http://localhost:1111", buster.sinon.match.func);
            },

        "captures headless browser if --capture-headless was passed":
            function () {
                var createServer = this.stub(this.cli, "createServer",
                    createServerFunc);
                var captureHeadlessBrowser = this.stub(this.cli,
                    "captureHeadlessBrowser");

                helper.run(this, ["--capture-headless"]);

                assert.calledOnce(captureHeadlessBrowser);
                assert.calledWithExactly(captureHeadlessBrowser,
                    "http://localhost:1111", buster.sinon.match.func);
            },

        "creates phantom session if relevant parameter was passed":
            function () {
                var createServer = this.stub(this.cli, "createServer",
                    createServerFunc);
                var createPhantom = this.stub(this.cli.phantom, "create");

                helper.run(this, ["-c"]);

                assert.calledOnce(createPhantom);
            },

        "waits until capture page responses": function () {
            var createServer = this.stub(this.cli, "createServer",
                createServerFunc);
            var responseCallback;
            var createPhantom = this.stub(this.cli.phantom, "create",
                function (cb) {
                    var proxy = {
                        page: {
                            open: function (url, cb) {
                                responseCallback = cb;
                            }
                        }
                    };
                    cb(proxy);
                });
            var cb = this.stub();

            helper.run(this, ["-c"], cb);
            refute.called(cb);
            responseCallback();
            assert.calledOnce(cb);
        }
    },

    "createServer": {
        setUp: function (done) {
            this.server = this.cli.createServer(9999);
            this.ua = "Mozilla/5.0 (X11; Linux x86_64; rv:2.0.1) " +
                "Gecko/20100101 Firefox/4.0.1";
            done();
        },

        tearDown: function (done) {
            this.server.on("close", done);
            this.server.close();
        },

        "serves header when captured": function (done) {
            helper.captureSlave(this.ua, function (e) {
                helper.get("/slave_header/", done(function (res, body) {
                    e.teardown();
                    assert.equals(res.statusCode, 200);
                    assert.match(body, "test slave");
                }));
            });
        },

        "serves static pages": function (done) {
            helper.get("/stylesheets/buster.css", done(function (res, body) {
                assert.equals(res.statusCode, 200);
                assert.match(body, "body {");
            }));
        },

        "serves templated pages": function (done) {
            helper.get("/", done(function (res, body) {
                assert.equals(res.statusCode, 200);
                assert.match(body, "<h1>Capture browser as test slave</h1>");
            }));
        },

        "reports no slaves initially": function (done) {
            helper.get("/", done(function (res, body) {
                assert.equals(res.statusCode, 200);
                assert.match(body, "<h2>No captured slaves</h2>");
            }));
        },

        "reports connected slaves": function (done) {
            helper.captureSlave(this.ua, function (slave) {
                helper.get("/", done(function (res, body) {
                    slave.teardown();
                    assert.equals(res.statusCode, 200);
                    assert.match(body, "<h2>Captured slaves (1)</h2>");
                }));
            });
        },

        "reports name of connected clients": function (done) {
            helper.captureSlave(this.ua, function (slave) {
                helper.get("/", done(function (res, body) {
                    slave.teardown();
                    assert.match(body, "<li class=\"firefox linux\">");
                    assert.match(body,
                                 "<h3>Firefox 4.0.1 on Linux 64-bit</h3>");
                }));
            });
        },

        "reports name newly connected ones": function (done) {
            helper.get("/", function (res, body) {
                helper.captureSlave(this.ua, function (slave) {
                    helper.get("/", done(function (res, body) {
                        slave.teardown();
                        assert.match(body, "<li class=\"firefox linux\">");
                        assert.match(body,
                                     "<h3>Firefox 4.0.1 on Linux 64-bit</h3>");
                    }));
                });
            }.bind(this));
        }
    },

    "captureHeadlessBrowser": {

        setUp: function () {
            this.openStub = this.stub();
            this.stub(this.cli.phantom, "create",
                function (cb) {
                    var proxy = {
                        page: {
                            open: this.openStub
                        }
                    };
                    cb(proxy);
                }.bind(this));

        },

        "ignores missing callback": function () {
            refute.exception(
                this.cli.captureHeadlessBrowser.bind(
                    this.cli, "http://localhost:1111"
                )
            );
        },

        "passes sessionId to capture page": function () {

            this.cli.captureHeadlessBrowser("http://localhost:1111", 0);

            assert.calledOnceWith(this.openStub, "http://localhost:1111/capture?id=0");
        },

        "doesn't pass sessionId if not defined": function () {

            this.cli.captureHeadlessBrowser("http://localhost:1111", function () {});

            assert.calledOnceWith(this.openStub, "http://localhost:1111/capture");
        }
    }
});
