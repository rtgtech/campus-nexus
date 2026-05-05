from __future__ import annotations

import itertools
import os
from copy import deepcopy
from typing import Any

from flask import Flask, jsonify, request

app = Flask(__name__)

DEFAULT_POST_IMAGE = (
    "https://lh3.googleusercontent.com/aida-public/"
    "AB6AXuDDbsQFosHW6vZSMffXbQjy-PzN-BoaByAnK_Sl_YFURfiMtKtThcON-b8DL2IDTKvMvU2NSqBHTN4XsURfSGSR8GYCacBCydrBdvSTc7o23v0F6RGvbsURQm5wt8ucXJM6CoPUd2hDx0Iwox_MfNZ85RjfPkecyZKOLXF9C_gJPF8v1hUdOF8eYEtpR2VYogWMBuM-2uovf2-Y8g_3OU5CBblw-bVGxFqGe9LMS1UeaRklI_oARDPiX34Z5Qk1F55QLV7lTJS87k0"
)
DEFAULT_CLUB_IMAGE = (
    "https://lh3.googleusercontent.com/aida-public/"
    "AB6AXuAw_Xv8hWpdYy2fAJ8I9evq8nybROQu14uCFeF7BZRZuOu0aVWOfVVcm2Z25TCZ7oGpOu_74XA8B5IvD31ynPpEdOMtxTy84zaPXwQkb7dsSgCMWdZtkiVoxdXAutvyPhdG7Jln2u7w3njLVqnhqEA0BhzXr5NxVBgRrhGbn6Lz_Q2gR5XfP9HvrAEuvSP_BzfVuIobWR_T_1XqkvX5yzQqQ-D715QeEUmsoOb-ieoHsfSOv2mIq6O3xyiWnrMnEMQFw1X9HbxMhEI"
)
PROFILE_AVATAR = (
    "https://lh3.googleusercontent.com/aida-public/"
    "AB6AXuDhDngMlYP4ueK1rG1n1YglyuSuKmiLwNG-IGppRVpb797E97d8FUPIs9VEvE16hsybk3Go6-T8GzOncJaTXlY7nPGsXxcTwHia2E_rH8uTXkZ9OSVohLz1qh9lf4sUWuSK4ytQiKdt8RKntmeCaNpWLo5qWyFIqjpC-erm324XgHDySw1tTQ4ATzhfggXDZ9l_FDNRcSZdQRAGSx2aQ6L08XDaDfkQk7PS5sxXWJBKvGGozrB47Ad76HIhmV3Ob2nr0kHSPiUWWDA"
)

post_ids = itertools.count(3)
club_ids = itertools.count(4)

feed_cards: list[dict[str, Any]] = [
    {
        "id": 1,
        "author": "Ananya Reddy",
        "meta": "2h ago - Architecture Dept",
        "title": "Rainy Bengaluru morning, full studio energy.",
        "body": "The design block lit up after the drizzle, so we stayed back to pin up prototypes and turn critique hour into a mini showcase.",
        "image": DEFAULT_POST_IMAGE,
        "tag": "#bengalurudesign",
        "likes": "1.2k",
        "comments": "42",
    },
    {
        "id": 2,
        "author": "Rohit Nair",
        "meta": "5h ago - Sports Club",
        "title": "Golden hour after practice in Bengaluru.",
        "body": "Placements are close, but the floodlights, chai break, and one last net session made the evening feel worth slowing down for.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuBwzpgmmiYF6RpJki5O0MBK3WD9yR4DhZsm4Fz7u0d1P203pGFKhis03MIUEN38icmvVItSo9XQhl9GGTMq3TMnRYjn5ckju4V6uii53IkzkHsZbQb2zV9qpiL_Q5hFKqtr7Hq7_csF5O3aaIoVmPUAIFdTuEPGVzYDAv-hloE7Kd6EynVr09EimJqdGWXdk9WBuNQYAgHWK6dDpqbuebxRRHoOG6DQ340iObPfIi2edREqK5fLiSwN-3THx82p7S7oHUp2xiZiln8",
        "tag": "#nammacampus",
        "likes": "856",
        "comments": "18",
    },
]

spotlight_clubs: list[dict[str, Any]] = [
    {
        "badge": "Trending",
        "badgeFill": True,
        "badgeClass": "bg-secondary",
        "title": "Bengaluru AI Collective",
        "description": "Building practical AI projects, campus tools, and responsible automation.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuB6gUvJTAIpwVMBX00dvhyPDuLb28fwbb_9D_py3kC_yYRDk1rlKioyZEST8bg59TxgdhzUHUwYRHxv5e7YvIGt7JAMWG1zQqWEhO_QU2qaVnnAxwrv6SWMZBiDOVHLtoU_4t75BsqQ_YIVav3jJSmgLSf_LQgcD7UpAt8Lrw7T8QpoYvsuifAYM27JpUyq4AAT1ewSEDRmXVg-ER5GhacBMp3ye2GzEPXqujtuEv2NdF4yX6D9y2JCmjaH_BYuCwp94IfV88U_JsA",
        "icon": "bolt",
    },
    {
        "badge": "Featured",
        "badgeFill": False,
        "badgeClass": "bg-primary-container",
        "title": "Namma Creators Collective",
        "description": "A collaboration hub for Bengaluru storytellers, filmmakers, and digital artists.",
        "image": "https://lh3.googleusercontent.com/aida-public/AB6AXuAT_Vk-jXlajrhtywbAPlc92j2juwHwrgFArbzjs51cAB8nZ-Y_R-uYevZhe4n_9I4ssF_-ShnTi03D-v5knHJl_STP21NI4B3M1ddoY8Ofq9oY9K9v35FIsijDtjW97-UwDlbhsgWcAiG7thMnb5dMeEUTWrUDj0ynYxihwMTXX4kco5CDNrqHdmS9JzsxdFfmjjpgZQT5zDqbzJ5nXqevL15ICN4y4C-FKDo-yLinqSrsXCGau-c9buyFssKWEJaoPAPYzEfa43g",
        "icon": "celebration",
    },
]

club_cards: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Bengaluru Builders Guild",
        "description": "A student builder community for hack nights, product sprints, and demo days across Bengaluru.",
        "status": "5 active projects",
        "icon": "code",
        "iconBg": "bg-primary",
        "bannerBg": "bg-primary-fixed/20",
        "bannerImage": DEFAULT_CLUB_IMAGE,
        "extraMembers": "+1.2k",
        "extraMembersClass": "bg-primary-container text-white",
        "avatars": [PROFILE_AVATAR, PROFILE_AVATAR],
        "statusClass": "text-secondary",
    },
    {
        "id": 2,
        "title": "Cubbon Park Runners",
        "description": "Weekend runs, conditioning meetups, and city race prep for students who like moving early.",
        "status": "Run in 2h",
        "icon": "directions_run",
        "iconBg": "bg-secondary",
        "bannerBg": "bg-secondary-container/10",
        "bannerImage": "https://lh3.googleusercontent.com/aida-public/AB6AXuCdOP8TLnf3ouBPsjSs_ssVQvpZ0RWrdFweagLGii4RfNUPToIewrWD2nkZZehZUYmJGgn961LgOT2ZKH9zzzwRXE5mN6wioVnUk-VIiiZExNKWh16XBSophAyCApQvsIsa2vTM9UqG8b6ILhJY9-biJqBMd5masncgCLEjBpoCaAh3BV-85hE4_ZkD0MkBOR_A3lU_1SfyV7etCc0lR8HDovh1dURUHyk78jRIAYH6m8_sVH4-tgVlYQytEQ_NAdgvp7tf07-VD-k",
        "extraMembers": "842",
        "extraMembersClass": "bg-surface-container-high text-on-surface",
        "avatars": [PROFILE_AVATAR, PROFILE_AVATAR],
        "statusClass": "text-secondary",
    },
    {
        "id": 3,
        "title": "Filter Coffee Collective",
        "description": "Exploring Bengaluru cafes, dosa spots, and late-night student food trails every week.",
        "status": "Active daily",
        "icon": "restaurant",
        "iconBg": "bg-tertiary",
        "bannerBg": "bg-tertiary-fixed/20",
        "bannerImage": "https://lh3.googleusercontent.com/aida-public/AB6AXuArlOY04LgVaqnmSR9kzO_5AuMuxKl05_CI7NUqYv3sae_w0ppAi9P8D_xHCxxfpLrrAlsJzYYorWFIAa1mPvCX_-9TmNDymjb2tDEzjHEKMeU_Z-YJb4r7dCIZkLKUkmQ5jZuBoyNt08Dq5icFQ9dz_dkpyjVLqiwMUF2OnNqpAxvytTRsLzOBjqsS2NJ6SbilxGX9vzzSluX0SDG9afZcC6t_HYE2oXWbLlv1qQ4LB6_gzTbfjWndvFGhR6tCcplV-nqYCsDbTYI",
        "extraMembers": "4.5k",
        "extraMembersClass": "bg-tertiary-fixed text-on-tertiary-fixed",
        "avatars": [PROFILE_AVATAR, PROFILE_AVATAR],
        "statusClass": "text-on-surface-variant",
    },
]


def read_json() -> dict[str, Any]:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = os.getenv("CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/health")
def health():
    return jsonify({"ok": True, "service": "campus-nexus-demo-backend"})


@app.route("/api/feed")
def feed():
    return jsonify(
        {
            "feedCards": deepcopy(feed_cards),
            "trending": [
                {"label": "Placements", "tag": "#BengaluruHiring", "posts": "126 posts today"},
                {"label": "College Fest", "tag": "#NammaUtsav", "posts": "1.8k posts this week"},
            ],
            "suggestedPeople": [
                {"name": "Meera Iyer", "subtitle": "Visual Communication"},
                {"name": "Aditya Shetty", "subtitle": "CSE - 2nd Year"},
                {"name": "Sanjana Rao", "subtitle": "Debate + Product"},
            ],
        }
    )


@app.route("/api/posts", methods=["POST", "OPTIONS"])
def create_post():
    if request.method == "OPTIONS":
        return ("", 204)

    data = read_json()
    post = {
        "id": next(post_ids),
        "author": data.get("author") or "Aarav Rao",
        "meta": data.get("meta") or "Just now - Campus Nexus",
        "title": data.get("title") or "New Bengaluru campus update",
        "body": data.get("body") or "A fresh update from the Campus Nexus demo flow.",
        "image": data.get("image") or DEFAULT_POST_IMAGE,
        "tag": data.get("tag") or "#campusnexus",
        "likes": "0",
        "comments": "0",
    }
    feed_cards.insert(0, post)
    return jsonify(post), 201


@app.route("/api/clubs")
def clubs():
    return jsonify(
        {
            "spotlightClubs": deepcopy(spotlight_clubs),
            "clubCards": deepcopy(club_cards),
            "stats": [
                {
                    "value": "124",
                    "label": "New Today",
                    "className": "rounded-[24px] border border-primary/10 bg-primary/5 p-6 text-center",
                    "valueClass": "text-display-lg font-display-lg text-primary",
                    "labelClass": "text-xs font-label-md uppercase tracking-widest text-primary/60",
                },
                {
                    "value": "2.8k",
                    "label": "City Clubs",
                    "className": "rounded-[24px] border border-surface-container-highest bg-white p-6 text-center shadow-sm",
                    "valueClass": "text-display-lg font-display-lg text-secondary",
                    "labelClass": "text-xs font-label-md uppercase tracking-widest text-on-surface-variant",
                },
                {
                    "value": "15k",
                    "label": "Members",
                    "className": "rounded-[24px] border border-surface-container-highest bg-white p-6 text-center shadow-sm",
                    "valueClass": "text-display-lg font-display-lg text-tertiary",
                    "labelClass": "text-xs font-label-md uppercase tracking-widest text-on-surface-variant",
                },
                {
                    "value": "42",
                    "label": "Live Now",
                    "className": "rounded-[24px] bg-primary p-6 text-center shadow-lg shadow-primary/20",
                    "valueClass": "text-display-lg font-display-lg text-white",
                    "labelClass": "text-xs font-label-md uppercase tracking-widest text-white/70",
                },
            ],
        }
    )


@app.route("/api/clubs", methods=["POST", "OPTIONS"])
def create_club():
    if request.method == "OPTIONS":
        return ("", 204)

    data = read_json()
    club = {
        "id": next(club_ids),
        "title": data.get("title") or "New Bengaluru Club",
        "description": data.get("description") or "A new student community for the Campus Nexus demo.",
        "status": "New today",
        "icon": "groups",
        "iconBg": "bg-primary",
        "bannerBg": "bg-primary-fixed/20",
        "bannerImage": data.get("bannerImage") or DEFAULT_CLUB_IMAGE,
        "extraMembers": "1",
        "extraMembersClass": "bg-primary-container text-white",
        "avatars": [PROFILE_AVATAR, PROFILE_AVATAR],
        "statusClass": "text-secondary",
    }
    club_cards.insert(0, club)
    return jsonify(club), 201


@app.route("/api/games")
def games():
    return jsonify(
        {
            "gameCards": [
                {"title": "Tower Stack", "image": DEFAULT_CLUB_IMAGE, "online": "1.2k Online", "rating": "4.8"},
                {"title": "Campus Quest", "image": DEFAULT_POST_IMAGE, "online": "840 Online", "rating": "4.9"},
                {"title": "Neon Pong", "image": DEFAULT_CLUB_IMAGE, "online": "3.5k Online", "rating": "4.7"},
                {"title": "Social Trivia", "image": DEFAULT_POST_IMAGE, "online": "2.1k Online", "rating": "4.6"},
            ],
            "topRated": [
                {
                    "rank": "01",
                    "title": "Word Blitz",
                    "subtitle": "Action Puzzle - 12k plays",
                    "rating": "5.0",
                    "badge": "Trending",
                    "image": DEFAULT_POST_IMAGE,
                    "badgeClass": "text-secondary",
                },
                {
                    "rank": "02",
                    "title": "Campus Run",
                    "subtitle": "Endless Runner - 8.4k plays",
                    "rating": "4.9",
                    "badge": "Stable",
                    "image": DEFAULT_CLUB_IMAGE,
                    "badgeClass": "text-outline",
                },
            ],
            "recentActivity": [
                {"title": "Cyber Drift", "subtitle": "Last played 2h ago", "image": DEFAULT_POST_IMAGE},
                {"title": "Tower Stack", "subtitle": "Last played Yesterday", "image": DEFAULT_CLUB_IMAGE},
            ],
        }
    )


@app.route("/api/messages")
def messages():
    return jsonify(
        {
            "conversations": [
                {"name": "Nisha Rao", "preview": "Are you going to the Indiranagar mixer tonight?", "time": "Just now", "active": True},
                {"name": "CSE Placement Prep", "preview": "Did anyone save the aptitude notes from...", "time": "12m ago"},
                {"name": "Karthik Menon", "preview": "Sent a photo", "time": "1h ago"},
                {"name": "Ananya Reddy", "preview": "That design sprint was intense, but it landed well.", "time": "Yesterday"},
            ],
            "messages": [
                {"side": "left", "text": "Did you see the lineup for the Bengaluru student fest? The main stage set looks solid."},
                {"side": "right", "text": "Yes. I am going if early access is still open for campus pass holders."},
                {"side": "left", "text": "A few slots are left. I booked mine already, and the poster drop looks great too."},
                {"side": "right", "text": "Send the link. I do not want to miss this one."},
            ],
        }
    )


@app.route("/api/profile/<user>")
def profile(user: str):
    return jsonify(
        {
            "avatar": PROFILE_AVATAR,
            "major": "Computer Science & Product Design, Bengaluru",
            "badge": "Senior",
            "stats": [["42", "Posts"], ["892", "Friends"], ["2.4k", "Nexus Score"]],
            "postImages": [DEFAULT_POST_IMAGE, DEFAULT_CLUB_IMAGE, DEFAULT_POST_IMAGE, DEFAULT_CLUB_IMAGE, DEFAULT_POST_IMAGE, DEFAULT_CLUB_IMAGE],
        }
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(
        host="127.0.0.1",
        port=port,
        debug=os.getenv("FLASK_DEBUG") == "1",
        use_reloader=False,
    )
