del index-linux
del index-macos
del index-win.exe
del upload\mtbridge-server-linux
del upload\mtbridge-server-macos
del upload\mt4bridge-server.exe
call pkg index.js
copy index-linux upload\mtbridge-server-linux
copy index-macos upload\mtbridge-server-macos
copy index-win.exe upload\mt4bridge-server.exe