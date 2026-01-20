
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ error: "No token, authorization denied" });

    try {
        const decoded = jwt.verify(token.split(" ")[1], 'secret_key');
        req.user = decoded; // Token se user ID mil jayegi
        next();
    } catch (err) {
        res.status(401).json({ error: "Token is not valid" });
    }
};
