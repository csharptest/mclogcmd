# mclogcmd

This repository is a running version of a Minecraft nodejs extension that monitor's the server logs and executes approved commands on behalf of the player.

### Minecraft Village Scripts ###

The most generic and interesting thing here is the building structures.  

* [Blacksmith Shop](https://github.com/csharptest/mclogcmd/blob/master/houses/blacksmith.txt)
* [Butcher House](https://github.com/csharptest/mclogcmd/blob/master/houses/butcher.txt)
* [Church](https://github.com/csharptest/mclogcmd/blob/master/houses/church.txt)
* [Farm (4 rows)](https://github.com/csharptest/mclogcmd/blob/master/houses/farm1.txt)
* [Farm (8 rows)](https://github.com/csharptest/mclogcmd/blob/master/houses/farm2.txt)
* [House (Large)](https://github.com/csharptest/mclogcmd/blob/master/houses/house.txt)
* [Lamp Post](https://github.com/csharptest/mclogcmd/blob/master/houses/lamp.txt)
* [Library](https://github.com/csharptest/mclogcmd/blob/master/houses/library.txt)
* [Shack V1 (With Lookout)](https://github.com/csharptest/mclogcmd/blob/master/houses/shack-v1.txt)
* [Shack V2 (Bevel Roof)](https://github.com/csharptest/mclogcmd/blob/master/houses/shack-v2.txt)
* [Shack V3 (Flat Roof)](https://github.com/csharptest/mclogcmd/blob/master/houses/shack-v3.txt)
* [Village Well](https://github.com/csharptest/mclogcmd/blob/master/houses/well.txt)

### Running Scripts ###

These are defined as command-block/user commands relative to their execution origin.  While this works for typing it into the command window, it's a little more difficult for a command-block.  To execute the commands relative to the player the node program executes something like the following:
```
/execute @p ~ ~ ~ /fill ~ ~ ~ ~1 ~ ~ stone_stairs
```
The other issue with these scripts is that they are always built-out in the same direction, east.  This is being handled currently by the rotation code in [build.js](https://github.com/csharptest/mclogcmd/blob/master/build.js) to produce 3 basic methods:

* FlipX - Flips all coordinates over the X axis
* FlipZ - Flips all coordinates over the Z axis
* SwapXZ - Swaps all X coordinates with the Z coordinates

From these we can build full rotation, for instance 90 degrees is  SwapXZ + FlipZ, 180 degrees is FlipX + FlipZ, and 270 degrees is SwapXZ + FlipX.

These 'base' transforms are exposed in the BuildScript class exported from [build.js](https://github.com/csharptest/mclogcmd/blob/master/build.js)

The last issue is that of them all being cobblestone and oak wood.  This is handled by the materials transform also exposed from [build.js](https://github.com/csharptest/mclogcmd/blob/master/build.js) by using one of the brick or wood transforms.

Note: While some effort has been made to support the various types of blocks in minecraft, there are many not supported.  This is currently just to support automation of village creation in a creative world.

## What is Server.js? ##

[Server.js](https://github.com/csharptest/mclogcmd/blob/master/server.js) and it's supporting configuration data (and commands) defined in [config.js](https://github.com/csharptest/mclogcmd/blob/master/config.js) allow a vanilla minecraft server to process commands for a user that he/she may not have access to.  

The node server listens to a configured minecraft server log file.  When it sees a command it thinks it should something with, it tries to execute it.  The command format is *nearly* identical to minecraft except for the preceeding hash '#', for example:
```
#/fill ~ ~ ~ ~1 ~1 ~1 stone
```

When the command format above is seen in the logs as a server-wide chat, it searches for the command in the configured `commands` section of the `config` object exposed from  [config.js](https://github.com/csharptest/mclogcmd/blob/master/config.js).  Commands come in 3 basic styles:

#####1. Commands that pass through to minecraft need only define a `match` expression:
```
tp: { match: /^\/tp/i }
```

#####2. Commands that execute external programs on the server need a file/args pair:
```
map-update: { match: /^\/map-update/i, file: '/opt/overviewer/update.sh', args: [] }
```

#####3. Lastly we have custom scripts which define an action handler as follows:
```
foo: { match: /^\/foo/i, file: 'foo', action: function(mcrun, data, complete) { ... } }
```

The file is specified in #3 above so that only 1 will execute at a time.  The parameters are as follows:
* *mcrun* - function(text, [callback]) a function that executes commands in minecraft.
* *data* - arguments in the form `{ username: 'minecraft user', command '/whatever' }`
* *complete* - function(err) a function that should be called when the operation is completed
 
