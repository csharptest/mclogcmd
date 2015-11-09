'use strict';
var childProcess = require('child_process');
var fs = require('fs');
var Path = require('path');
var BuildScript = require('./build');

function copyFile(source, target, cb) {
    var cbCalled = false;

    console.log('Copy file %s to %s', source, target);
    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
    var rd = fs.createReadStream(source);
    rd.on('error', function(err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on('error', function(err) {
        done(err);
    });
    wr.on('close', function(/*e?*/) {
        done();
    });
    rd.pipe(wr);

}

function msm(args, callback) {
    console.log('> /usr/local/bin/msm ' + args.join(' '));
    childProcess.execFile('/usr/local/bin/msm', args, {
        cwd: __dirname,
        timeout: 60000
    }, function (err, stdOut, stdErr) {
        if (err) {
            console.log(err.message);
            return callback(err);
        }
        if (stdErr.length) {
            console.log('! ' + stdErr.toString());
        }
        if (stdOut.length) {
            console.log('< ' + stdOut.toString());
        }

        callback();
    });
}

function playerInfo(username) {

    var gameBase = '/opt/msm/servers/survival/';
    var players = {};
    JSON.parse(fs.readFileSync(gameBase + 'whitelist.json'))
        .forEach(function(p) { players[p.name.toLowerCase()] = p.uuid; });
    var uuid = players[username.toLowerCase()];
    var pthData = Path.join(gameBase + 'world/playerdata/', (uuid || '') + '.dat');
    if (!uuid || !fs.existsSync(pthData)) {
        throw new Error('Unable to locate player data.');
    }
    var pthBack = Path.join(gameBase + 'playerStore/', uuid + '.dat');
    return {
        name: username,
        uuid: uuid,
        dat: pthData,
        bak: pthBack
    };
}

var config = {
    minecraft: {
        log: '/opt/msm/servers/survival/logs/latest.log',
        cwd: '.',
        timeout: 10000,
        logFormat: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: [<\[](\w+)[>\]] #(\/.*)\s*$/i,
        badCommand: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: (Failed to execute '.*') as (\w+)\s*$/i
    },
    mcexec: {
        file: '/usr/local/bin/msm',
        args: ['survival', 'cmd']
    },
    mcrunas: {
        args: ['/execute @p[name={username},x=-2000,y=64,z=-250,r=2000] ~ ~ ~ {command}']
    },
    mctell: {
        args: ['/tell {username} {command}']
    },
    commands: {
        tp: { match: /^\/tp @p /i },
        fill: { match: /^\/fill /i },
        clone: { match: /^\/clone /i },
        blockdata: { match: /^\/blockdata /i },
        setblock: { match: /^\/setblock /i },
        summon: { match: /^\/summon /i },
        weather: { match: /^\/weather /i },
        'map-update': {
            match: /^\/map-update/i,
            file: '/opt/msm/scripts/update.sh',
            started: 'Started updating the map.',
            complete: 'Finished updating the map.'
        },
        build: {
            match: /^\/build/i,
            file: 'building',
            action: function(mcrun, data, complete) {
                var test = data.command.match(/^\/build\s+([\w_\-\.]+)((\s+[\w]+)*)/i);
                var bs = null;
                if (test) {
                    var pth = Path.join(__dirname, 'houses', test[1].replace(/\.txt$/i, '') + '.txt');
                    if (fs.existsSync(pth)) {
                        bs = new BuildScript(fs.readFileSync(pth).toString());
                    }
                }
                if (!bs) {
                    fs.readdir(
                        Path.join(__dirname, 'houses'),
                        function (err, items) {
                            if (err) {
                                console.log(err);
                            }
                            mcrun('/tell ' + data.username + ' Available plans: ' +
                                (items || []).map(function (p) {
                                    return p.slice(0, -4);
                                }).join(', '));
                            complete();
                        });
                }
                if (test[2]) {
                    var xforms = test[2].match(/\w+/gi);
                    xforms.forEach(function(nm) {
                        nm = nm.toLowerCase();
                        var fn = bs.Transforms[nm];
                        if (fn) {
                            bs.addTransform(fn);
                        }
                    });
                    if (xforms.indexOf('flip') >= 0) {
                        bs.addTransform(bs.Transforms.flipz);
                    }
                    if (xforms.indexOf('east') >= 0) { /* empty */ }
                    else if (xforms.indexOf('west') >= 0) {
                        bs.addTransform(bs.Transforms.flipz);
                        bs.addTransform(bs.Transforms.flipx);
                    }
                    else if (xforms.indexOf('north') >= 0) {
                        bs.addTransform(bs.Transforms.swapxz);
                        bs.addTransform(bs.Transforms.flipz);
                    }
                    else if (xforms.indexOf('south') >= 0) {
                        bs.addTransform(bs.Transforms.swapxz);
                        bs.addTransform(bs.Transforms.flipx);
                    }
                }

                var file = [];
                bs.apply(function(txt) { file.push(txt); });
                var runToEnd = function (ix) {
                    console.log('running step ' + ix.toString() + ': ' + file[ix]);
                    if (ix < file.length && file[ix] && file[ix][0] === '/') {
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' + file[ix], function() {
                            runToEnd(ix + 1);
                        });
                    } else if (ix < file.length) {
                        runToEnd(ix + 1);
                    } else {
                        complete();
                    }
                };
                runToEnd(0);
            }
        },
        variants: {
            match: /^\/variants/i,
            file: 'building',
            action: function(mcrun, data, complete) {
                var test = data.command.match(/^\/variants\s+([\w_\-\.]+)/i);
                if (!test) {
                    mcrun('/tell ' + data.username + ' please specify a block type.');
                    return complete();
                }
                var block = test[1];
                var ix, xoff, zoff;

                if (block.match(/_door$/)) {
                    for (ix = 0; ix < 4; ix++) {
                        xoff = ix * 2 + 1;
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' +
                            '/setblock ~' + xoff.toString() + ' ~ ~ standing_sign 5 replace {Text1:' + block + '#' + ix.toString() + '-' + (ix + 8).toString() + '}');
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' +
                            '/setblock ~' + xoff.toString() + ' ~ ~1 ' + block + ' ' + ix.toString());
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' +
                            '/setblock ~' + xoff.toString() + ' ~1 ~1 ' + block + ' 8');
                    }
                }
                else {
                    for (ix = 0; ix < 16; ix++) {
                        xoff = ix + 1;
                        zoff = (ix % 2);
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' +
                            '/setblock ~' + xoff.toString() + ' ~ ~' + zoff.toString() + ' standing_sign 5 replace {Text1:' + block + '#' + ix.toString() + '}');
                        mcrun('/execute ' + data.username + ' ~ ~ ~ ' +
                            '/setblock ~' + xoff.toString() + ' ~ ~' + (zoff + 1).toString() + ' ' + block + ' ' + ix.toString());
                    }
                }
                complete();
            }
        },
        'gamemode creative': {
            match: /^\/gamemode\s+c(reative)?$/i,
            file: 'gamemode',
            action: function(mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to creative!');
                var fail = function(message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try { player = playerInfo(data.username); }
                catch(ex) { return fail(ex.message); }
                if (fs.existsSync(player.bak)) {
                    return fail('You are already in adventure/creative mode.');
                }

                msm(['survival', 'save', 'all'], function (err) {
                    if (err) {
                        //return fail('Unable to save the world.');
                    }

                    copyFile(player.dat, player.bak, function (ecopy) {
                        if (ecopy) {
                            return fail('Unable to create backup.');
                        }

                        mcrun('/tp ' + data.username + ' 143 60 5083');
                        complete();
                    });
                });
            }
        },
        'gamemode adventure': {
            match: /^\/gamemode\s+a(dventure)?$/i,
            file: 'gamemode',
            action: function(mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to adventure!');
                var fail = function(message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try { player = playerInfo(data.username); }
                catch(ex) { return fail(ex.message); }
                if (fs.existsSync(player.bak)) {
                    return fail('You are already in adventure/creative mode.');
                }

                msm(['survival', 'save', 'all'], function (err) {
                    if (err) {
                        //return fail('Unable to save the world.');
                    }

                    copyFile(player.dat, player.bak, function (ecopy) {
                        if (ecopy) {
                            return fail('Unable to create backup.');
                        }

                        mcrun('/tp ' + data.username + ' 129 60 5083');
                        complete();
                    });
                });
            }
        },
        'gamemode survival': {
            match: /^\/gamemode\s+s(urvival)?$/i,
            file: 'gamemode',
            action: function (mcrun, data, complete) {
                mcrun('/tell ' + data.username + ' going to survival, you will momentarily booted off!');
                var fail = function (message) {
                    mcrun('/tell ' + data.username + ' ' + (message || 'Something went wrong.'));
                    return complete();
                };

                var player;
                try {
                    player = playerInfo(data.username);
                }
                catch (ex) {
                    return fail(ex.message);
                }
                if (!fs.existsSync(player.bak)) {
                    return fail('You are already in survival.');
                }

                msm(['survival', 'kick', data.username], function () {
                    msm(['survival', 'bl', 'player', 'add', data.username], function () {
                        msm(['survival', 'save', 'all'], function () {
                            copyFile(player.bak, player.dat, function (ecopy) {
                                if (!ecopy) {
                                    fs.unlink(player.bak, function(erm) {
                                        if (erm) { console.error(erm); }
                                    });
                                }
                                msm(['survival', 'bl', 'player', 'remove', data.username], function () {
                                    if (ecopy) {
                                        return fail('Unable to create backup.');
                                    }
                                    complete();
                                });
                            });
                        });
                    });
                });
            }
        }
    }
};

module.exports = config;
