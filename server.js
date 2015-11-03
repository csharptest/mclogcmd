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
    for (var ix = 0; ix < config.commands.length; ix++) {
        if (!config.commands[ix].match) {
            continue;
        }

        var m = command.match(config.commands[ix].match);
        if (m) {
            return true;
        }
    }
    return false;
}

function splitArguments(text) {
    return text.split(' ');
}

function executeCommand(username, command) {
    try {
        var cmd = config.minecraft.execArgs
            .replace('{username}', username)
            .replace('{command}', command);

        var args = splitArguments(cmd);

        console.log('> ' + execFile + ' ' + cmd);
        childProcess.execFile(execFile, args, {
                cwd: Path.resolve(config.minecraft.cwd),
                timeout: config.minecraft.timeout
            },
            function (err, stdOut, stdErr) {
                if (err) {
                    console.error(err.message);
                }
                if (stdErr.length) {
                    //console.error('! ' + stdErr.toString());
                }

                if (stdOut.length) {
                    //console.log('< ' + stdOut.toString());
                }
            });
    }
    catch(ex) {
        console.error('ERR: ' + ex.message);
    }
}

function parseLogFile() {
    timerPending = false;
    var content;
    try {
        content = fs.readFileSync(config.minecraft.log);
    } catch(ex) {
        console.error(ex.message);
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
        var match = lines[parseState.lines].match(config.minecraft.logFormat);
        if(match) {
            //console.log(JSON.stringify(match));
            if (allowCommand(match[1], match[2])) {
                executeCommand(match[1], match[2]);
            }
            else {
                console.error('Invalid command: <%s> %s', match[1], match[2]);
            }
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
