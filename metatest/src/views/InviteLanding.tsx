import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Landing page for shared invite links (/invite/:code).
// Persists the invite code so registration can attribute the referral,
// then forwards the user into the app.
export default function InviteLanding() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();

    useEffect(() => {
        if (code) {
            localStorage.setItem("invite_code", code);
        }
        navigate("/", { replace: true });
    }, [code, navigate]);

    return null;
}
