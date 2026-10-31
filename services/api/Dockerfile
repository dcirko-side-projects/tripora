FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY services/api/Tripora.Api.csproj services/api/
RUN dotnet restore services/api/Tripora.Api.csproj
COPY services/api/ services/api/
RUN dotnet publish services/api/Tripora.Api.csproj -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 ASPNETCORE_ENVIRONMENT=Production
COPY --from=build /out ./
COPY --chmod=755 services/api/start.sh /app/start.sh
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["/app/start.sh"]
