#!/bin/bash
qecho() {  echo -n -e "\e[$2m$1\e[0m"; }

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
USER=$(logname)

TARGET=~/.local/share/cinnamon/applets

qecho "QRedshift Cinnamon Installation Script! \n" "1"

LAST_VERSION=$(curl -s "https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/files/qredshift%40quintao/metadata.json" | sed -n -E 's/.+"version"\s*:\s*"(.+)".+/\1/p')

ZIP='https://github.com/raphaelquintao/QRedshiftCinnamon/archive/refs/heads/master.tar.gz'


qecho "Last Version: " "1:33"; qecho "${LAST_VERSION}\n" "1;33";

#mkdir -p $TARGET

qecho " => " "1"; qecho "Downloading files..." "0;32"
#curl --progress-bar -o $TARGET/master.tar.gz -L $ZIP
curl -s -o $TARGET/master.tar.gz -L $ZIP
qecho " Done!\n" "1"

qecho " => " "1"; qecho "Unzipping..." "0;32"
tar -xzf $TARGET/master.tar.gz -C $TARGET
qecho " Done!\n" "1"

qecho " => " "1"; qecho "Installing..." "0;32"
cp -r $TARGET/QRedshiftCinnamon-master/files/qredshift@quintao  $TARGET
rm -r $TARGET/QRedshiftCinnamon-master
qecho " Done!\n" "1"

qecho " => " "1"; qecho "Opening Applets Settings..." "0;32"
setsid cinnamon-settings applets &> /dev/null &
qecho " Done!\n" "1"

qecho " => " "1"; qecho "Reloading Applet..." "0;32"
dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:qredshift@quintao string:'APPLET'
qecho " Done!\n" "1"