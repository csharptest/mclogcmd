'use strict';
/**
 * Created by rogerk on 10/20/15.
 */
var childProcess = require('child_process');
var fs = require('fs');
var Path = require('path');
var timers = require('timers');
var extend = require('util')._extend;
var config = require('./config');

var timerPending = false;
var parseState = {};

var running = {};
var pending = {};

function findCommand(values) {
    var keys = Object.keys(config.commands);
    for (var ix = 0; ix < keys.length; ix++) {
        var cmd = config.commands[keys[ix]];
        if (cmd.match) {
            var m = values.command.match(cmd.match);
            if (m) {
                return extend({ name: keys[ix] }, cmd);
            }
        }
    }
    return null;
}

function replaceValues(txt, values) {
    var keys = Object.keys(values);
    for (var ix = 0; ix < keys.length; ix++) {
        txt = txt.replace('{' + keys[ix] + '}', values[keys[ix]]);
    }
    return txt;
}

function executeCommand(cmd, values, completed) {

    cmd = extend({
        cwd: Path.resolve(cmd.cwd || __dirname),
        timeout: config.minecraft.timeout || 10000
    }, cmd);
    if (!cmd.hasOwnProperty('file')) {
        cmd.file = config.mcexec.file;
        cmd.args = config.mcexec.args.concat(cmd.args || config.mcrunas.args);
    }

    if (running[cmd.file]) {
        pending[cmd.file] = (pending[cmd.file] || []).concat([{command: cmd, values: values}]);
        return;
    }
    running[cmd.file] = true;
    var finished = function() {
        running[cmd.file] = false;
        try {
            if (cmd.complete) {
                timers.setTimeout(function() { executeCommand(config.mctell, {username: values.username, command: cmd.complete}); }, 1);
            }
            if (completed) {
                completed();
            }
        }
        catch(ex) { console.error(ex); }

        if (pending[cmd.file] && pending[cmd.file].length > 0) {
            var next = pending[cmd.file][0];
            pending[cmd.file] = pending[cmd.file].splice(1);
            timers.setTimeout(function() { executeCommand(next.command, next.values); }, 10);
        }
    };

    try {
        var args = (cmd.args || []).map(function(arg) { return replaceValues(arg, values); });

        console.log('> ' + cmd.file + ' ' + args.join(' '));
        if (cmd.file !== config.mcexec.file && cmd.started) {
            timers.setTimeout(function() { executeCommand(config.mctell, {username: values.username, command: cmd.started}); }, 1);
        }

        if (cmd.action) {
            cmd.action(
                function rawMcCommand(cmdText, callback) {
                    var scmd = extend({}, config.mcexec);
                    scmd.args = scmd.args.concat([cmdText]);
                    executeCommand(scmd, {username: values.username, command: ''}, callback);
                },
                extend({}, values),
                finished
            );
        }
        else {
            childProcess.execFile(cmd.file, args, {
                    cwd: Path.resolve(cmd.cwd || __dirname),
                    timeout: config.minecraft.timeout || 10000
                },
                function (err, stdOut, stdErr) {
                    if (err) {
                        console.log(err.message);
                    }
                    if (stdErr.length) {
                        console.log('! ' + stdErr.toString());
                    }
                    if (stdOut.length) {
                        console.log('< ' + stdOut.toString());
                    }

                    finished();
                });
        }
    }
    catch(ex) {
        console.log('ERR: ' + ex.message);
        finished();
    }
}

function parseLogLine(line) {
    if (!line) {
        return null;
    }
    var match = line.match(config.minecraft.logFormat);
    if(match) {
        var values = {
            username: match[1],
            command: match[2]
        };
        var cmd = findCommand(values);
        if (cmd) {
            return executeCommand(cmd, values);
        }
        else if (values.command.match(/^\/help/i)) {
            return executeCommand(config.mctell, {
                username: values.username,
                command: 'Available commands: ' + Object.keys(config.commands).join(', ')
            });
        }
        else {
            values.command = 'Unknown command: ' + values.command;
            return executeCommand(config.mctell, values);
        }
    }

    match = line.match(config.minecraft.badCommand);
    if (match) {
        values = {
            username: match[2],
            command: match[1].replace(/["']+/g, '')
        };
        return executeCommand(config.mctell, values);
    }
    return null;
}

function parseLogFile() {
    timerPending = false;
    var content;
    try {
        content = fs.readFileSync(config.minecraft.log);
    } catch(ex) {
        console.log(ex.message);
        return;
    }

    var lines = content.toString().split('\n');
    lines.pop();

    if (!parseState.lines) {
        parseState.lines = lines.length;
        return;
    }
    if (parseState.lines > lines.length) {
        parseState.lines = 0;
    }

    for (parseState.lines; parseState.lines < lines.length; parseState.lines++) {
        var line = lines[parseState.lines].replace('\r', '');
        try {
            parseLogLine(line);
        }
        catch (ex) {
            console.log('ERR: ' + ex.toString());
        }
    }
    //console.log(JSON.stringify(parseState));
}

parseLogFile();

var notify = new (require('fs.notify'))([config.minecraft.log]);
notify.on('change', function(path, op) {
        console.log('Changed: %s %s ', op, path);
        if (!timerPending) {
            timerPending = true;
            timers.setTimeout(parseLogFile, 100);
        }
    });

console.log('Started OK.');
