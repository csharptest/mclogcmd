'use strict';
/**
 * Created by rogerk on 10/20/15.
 */
var childProcess = require('child_process');
var fs = require('fs');
var Path = require('path');
var timers = require('timers');

var root = Path.resolve(__dirname);
var timerPending = false;
var config = require(Path.join(root, 'config'));
var execFile = Path.resolve(config.minecraft.execFile);

var parseState = {};

function allowCommand(username, command) {
    var result = false;
    Object.keys(config.commands).forEach(
        function(k) {
        var cmd = config.commands[k];
        if (cmd.match) {
            var m = command.match(cmd.match);
            if (m) {
                result = true;
            }
        }
    });
    return result;
}

function executeCommand(username, command) {
    try {
        var args = (!username ? config.minecraft.execArgsNoUser : config.minecraft.execArgs)
            .map(function(txt) {
                return txt.replace('{username}', username)
                    .replace('{command}', command)
                    .replace(/'/g, '\\\'');
            });

        console.log('> ' + execFile + ' ' + args.join(' '));
        childProcess.execFile(execFile, args, {
                cwd: Path.resolve(config.minecraft.cwd),
                timeout: config.minecraft.timeout
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
            });
    }
    catch(ex) {
        console.log('ERR: ' + ex.message);
    }
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
        var match = line.match(config.minecraft.logFormat);
        if(match) {
            //console.log(JSON.stringify(match));
            if (allowCommand(match[1], match[2])) {
                executeCommand(match[1], match[2]);
            }
            else {
                executeCommand(null, '/tell ' + match[1] + ' Invalid command: ' + match[2]);
            }
            continue;
        }

        match = line.match(config.minecraft.badCommand);
        if (match) {
            var tell = '/tell ' + match[2] + ' ' + match[1];
            timers.setTimeout(executeCommand.apply(null, [null, tell]), 100);
            continue;
        }
    }

    console.log(JSON.stringify(parseState));
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
