module.exports = {
    minecraft: {
        log: '/opt/msm/servers/survival/logs/latest.log',
        cwd: '.',
        timeout: 10000,
        logFormat: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: <(\w+)> #(\/.*)\s*$/i,
        badCommand: /^\[\d\d:\d\d:\d\d] \[Server thread\/INFO]: (Failed to execute '.*') as (\w+)\s*$/i
    },
    mcexec: {
        file: '/usr/local/bin/msm',
        args: ['survival', 'cmd', 'execute @p[name={username},x=-2000,y=64,z=-250,r=2000] ~ ~ ~ {command}']
    },
    mctell: {
        file: '/usr/local/bin/msm',
        args: ['survival', 'cmd', '/tell {username} {command}']
    },
    commands: {
        tp: { match: /^\/tp @p ~|\d/i },
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
        }
    }
};
