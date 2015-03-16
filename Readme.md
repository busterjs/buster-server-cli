# buster-server-cli #

[![Build status](https://secure.travis-ci.org/busterjs/buster-server-cli.png?branch=master)](http://travis-ci.org/busterjs/buster-server-cli)

Command-line interface API for running [ramp](https://github.com/busterjs/ramp/)
instances with a simple interface that allows capturing and viewing a list of
connected browsers.

In Buster, this module is the implementation of the `buster server` command. It
does not define the binary however, as it is intended to be generic enough to be
reused outside of Buster.

## Possible use cases ##

The capture server is the central piece in Buster's multiple browser automation
capabilities. This module can be used as is to run tests for any framework, as
it does not know anything about tests at all. However, if you're shipping a
capture server for your own framework, you may want to brand your server a
little.

The following example shows how to create a custom capture server for the
fictional `checkit` test framework.

### The binary ###

    // checkit/bin/checkit-server
    var path = require("path");
    var serverCli = require("buster-server-cli");

    serverCli.create(process.stdout, process.stderr, {
        missionStatement: "Checkit crazy multi-browser test runner server",
        description: "checkit-server [options]",
        templateRoot: path.join(__dirname, "..", "views"),
        documentRoot: path.join(__dirname, "..", "public")
    }).run(process.argv.slice(2));

### The index template ###

You need to define two templates for the server to work correctly. The first one
is `index.ejs`, which is an [ejs](http://embeddedjs.com/) template for the
index page of the server. [Buster's index template](https://github.com/busterjs/buster-server-cli/blob/master/views/index.ejs)
renders a list of captured browsers and a link to `/capture`, which is the
URL that causes the browser to become a captured slave.

The `index.ejs` template is rendered with one piece of data — `slaves` — which
is an array of slave objects:

* `slave.browser` A string, i.e. "Firefox"
* `slave.platform` A string, i.e. "Linux"
* `slave.version` A string, i.e. "12.0"
* `slave.os` A string, contains a richer OS/platform description
* `slave.userAgent` The original user agent

### The header template ###

The second template is the `header.ejs` template. It is used in the top frame
in the frameset that is displayed in captured slaves. Currently this is just
a static template, but future versions will expose an API to communicate with
the server here to display progress etc.

See [Buster's header template](https://github.com/busterjs/buster-server-cli/blob/master/views/header.ejs)
for a reference implementation.

## Changelog

**0.3.4** (16.03.2015)

* [Additional param `sessionId` for method `captureHeadlessBrowser`.](https://github.com/busterjs/buster-server-cli/commit/dcb4d19)

**0.3.3** (12.03.2015)

* [Waits now until headless browser is started before calling callback of run. Needed for buster-ci.](https://github.com/busterjs/buster-server-cli/commit/6cf0b3f290)

**0.3.2** (23.01.2015)

* Fix for issue [#432 - buster-server says "running" even if address is already in use](https://github.com/busterjs/buster/issues/432)
* PR [`agent.name` could somehow be `null` and will cause `buster-server-cli` to exit](https://github.com/busterjs/buster-server-cli/pull/6)

**0.3.1** (17.09.2014)

* Fix for issue [#416 - buster-server crash with IE 11 on W7 only if there is two browsers captured](https://github.com/busterjs/buster/issues/416)
