#!/bin/bash
qecho() {  echo -n -e "\e[$2m$1\e[0m"; }

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
USER=$(logname)

TARGET=~/.local/share/cinnamon/applets

qecho "QRedshift Cinnamon Installtion Script! \n" "1"

METADATA=$(curl -s "https://raw.githubusercontent.com/raphaelquintao/QRedshiftCinnamon/master/files/qredshift%40quintao/metadata.json" | sed -n -E 's/.+"version"\s*:\s*"(.+)".+/\1/p')

ZIP='https://github.com/raphaelquintao/QRedshiftCinnamon/archive/refs/heads/master.tar.gz'

mkdir -p $TARGET

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
