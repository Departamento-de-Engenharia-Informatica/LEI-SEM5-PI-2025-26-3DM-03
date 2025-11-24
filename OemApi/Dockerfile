# syntax=docker/dockerfile:1.6

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["OemApi/OemApi.csproj", "OemApi/"]
COPY ["frameworkDDD/FrameworkDDD.csproj", "frameworkDDD/"]

RUN dotnet restore "OemApi/OemApi.csproj"

COPY . .
RUN dotnet publish "OemApi/OemApi.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV DISABLE_OIDC=true

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "OemApi.dll"]
