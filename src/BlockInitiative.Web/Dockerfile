FROM node:24-alpine AS frontend
WORKDIR /src/src/BlockInitiative.Web/Client

COPY ["src/BlockInitiative.Web/Client/package.json", "./"]
COPY ["src/BlockInitiative.Web/Client/tsconfig.json", "./"]
COPY ["src/BlockInitiative.Web/Client/vite.config.ts", "./"]
COPY ["src/BlockInitiative.Web/Client/src", "./src"]
COPY ["src/BlockInitiative.Web/Client/test", "./test"]
RUN npm install --no-audit --no-fund && npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["src/BlockInitiative.Core/BlockInitiative.Core.csproj", "src/BlockInitiative.Core/"]
COPY ["src/BlockInitiative.Web/BlockInitiative.Web.csproj", "src/BlockInitiative.Web/"]
RUN dotnet restore "src/BlockInitiative.Web/BlockInitiative.Web.csproj"

COPY . .
COPY --from=frontend /src/src/BlockInitiative.Web/wwwroot ./src/BlockInitiative.Web/wwwroot
RUN dotnet publish "src/BlockInitiative.Web/BlockInitiative.Web.csproj" -c Release -o /app/publish /p:UseAppHost=false -p:BuildClient=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "BlockInitiative.Web.dll"]
