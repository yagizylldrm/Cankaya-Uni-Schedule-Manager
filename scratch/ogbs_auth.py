import os


def get_ogbs_token() -> str:
    """
    OGBS API tokenini OGBS_API_TOKEN ortam değişkeninden okur.
    Eksikse güvenli ve bilgilendirici bir hata fırlatır.
    """
    token = os.environ.get("OGBS_API_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "OGBS_API_TOKEN ortam değişkeni ayarlanmamış. "
            "Lütfen geçerli tokenı OGBS_API_TOKEN ortam değişkeni olarak tanımlayın."
        )
    return token


def get_ogbs_auth_header() -> str:
    """Bearer önekiyle birlikte Authorization başlığı değerini döner."""
    token = get_ogbs_token()
    if token.lower().startswith("bearer "):
        return token
    return f"Bearer {token}"
