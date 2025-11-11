# syntax=docker/dockerfile:1.6

# -------- Build stage --------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy project files for restore
COPY ["TodoApi/TodoApi.csproj", "TodoApi/"]
COPY ["frameworkDDD/FrameworkDDD.csproj", "frameworkDDD/"]

# restore dependencies
RUN dotnet restore "TodoApi/TodoApi.csproj"

# copy all sources and publish
COPY . .
RUN dotnet publish "TodoApi/TodoApi.csproj" -c Release -o /app/publish --no-restore

# -------- Runtime stage --------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# App listens on 8080 by default (override with ASPNETCORE_URLS)
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
# Disable OIDC in container by default; override in real environments
ENV DISABLE_OIDC=true

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "TodoApi.dll"]
