@echo off
start chrome --new-window --app="http://localhost:8080/?numScreens=3&screenId=1" --window-position=0,0 --window-size=600,800 --user-data-dir="%TEMP%\lg_chrome_1"
start chrome --new-window --app="http://localhost:8080/?numScreens=3&screenId=2" --window-position=600,0 --window-size=600,800 --user-data-dir="%TEMP%\lg_chrome_2"
start chrome --new-window --app="http://localhost:8080/?numScreens=3&screenId=3" --window-position=1200,0 --window-size=600,800 --user-data-dir="%TEMP%\lg_chrome_3"
