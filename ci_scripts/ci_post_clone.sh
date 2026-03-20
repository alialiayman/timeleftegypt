#!/bin/sh
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install --repo-update
