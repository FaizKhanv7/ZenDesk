# server/server.py (optional)
from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.json
    emails = data.get("emails", [])
    unread = [e for e in emails if e.get("unread")]
    counts = {}
    for e in unread:
        label = e.get("label", "other")
        counts[label] = counts.get(label, 0) + 1
    tldr = f"{len(unread)} new emails: " + ", ".join([f"{v} {k}" for k,v in counts.items()])
    subjects = " • ".join([e.get("subject","") for e in unread[:5]])
    return jsonify({"tldr": tldr, "subjects": subjects})

if __name__ == "__main__":
    app.run(port=5000)
