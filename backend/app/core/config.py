from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AR Model Explorer"
    debug: bool = False
    database_url: str = "sqlite:///./ar_model_explorer.db"
    cors_origins: str = "http://localhost:5173"

    # No default on purpose: the app refuses to start without a real secret.
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()