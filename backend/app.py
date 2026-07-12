from schema_app import *  # noqa: F401,F403


if __name__ == "__main__":
    ensure_database_initialized()
    port = int(os.getenv("PORT", "5000"))
    app.run(
        host="127.0.0.1",
        port=port,
        debug=os.getenv("FLASK_DEBUG") == "1",
        use_reloader=False,
    )
