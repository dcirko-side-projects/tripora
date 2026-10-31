#!/bin/sh
set -eu
dotnet Tripora.Api.dll --migrate
exec dotnet Tripora.Api.dll
