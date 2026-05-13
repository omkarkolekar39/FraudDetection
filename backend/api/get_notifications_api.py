from sqlalchemy import or_
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from config.db_config import get_db
from database.notification_table import Notification
from services.login_service import get_current_user

router = APIRouter()


def _notification_scope_query(db: Session, current_user):
    return db.query(Notification).filter(
        or_(
            Notification.target_username == current_user.username,
            Notification.target_role == current_user.role,
            Notification.target_role == "All",
        )
    )


def _user_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    return []


def _is_read_for_user(notification: Notification, username: str) -> bool:
    return bool(notification.is_read) or username in _user_list(notification.read_by)


def _is_deleted_for_user(notification: Notification, username: str) -> bool:
    return username in _user_list(notification.deleted_by)


def _mark_read_for_user(notification: Notification, username: str) -> None:
    read_by = _user_list(notification.read_by)
    if username not in read_by:
        notification.read_by = [*read_by, username]

    if notification.target_username == username:
        notification.is_read = True


def _mark_deleted_for_user(notification: Notification, username: str) -> None:
    deleted_by = _user_list(notification.deleted_by)
    if username not in deleted_by:
        notification.deleted_by = [*deleted_by, username]

@router.get("/my-alerts")
def fetch_notifications(
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    NEURAL ALERT FEED
    Fetches the latest 10 notifications for the logged-in user.
    """
    try:
        notifs = (
            _notification_scope_query(db, current_user)
            .order_by(Notification.timestamp.desc(), Notification.id.desc())
            .limit(50)
            .all()
        )

        # 2. Add a 'System' notification if the RAM Buffer is active but no DB alerts exist
        # This helps the user know the system is alive even if the DB is fresh
        results = []
        for n in notifs:
            if _is_deleted_for_user(n, current_user.username):
                continue

            results.append({
                "id": n.id,
                "message": n.message,
                "type": "warning" if "risk" in n.message.lower() else "info",
                "is_read": _is_read_for_user(n, current_user.username),
                "time": n.timestamp.strftime("%d %b %Y, %I:%M %p") if n.timestamp else "Just now"
            })
            if len(results) >= 20:
                break

        # Fallback: If DB is empty but data is loaded in RAM
        if not results and getattr(request.app.state, 'raw_df', None) is not None:
            results.append({
                "id": 0,
                "message": "Neural Buffer Secured: 150 records awaiting analysis.",
                "type": "success",
                "is_read": True,
                "time": "System"
            })

        return results

    except Exception as e:
        print(f"NOTIF FETCH ERROR: {e}")
        return []


@router.put("/read/{notification_id}")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notification = _notification_scope_query(db, current_user).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    _mark_read_for_user(notification, current_user.username)
    db.commit()
    return {"status": "success", "message": "Notification marked as read."}


@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notifications = _notification_scope_query(db, current_user).all()
    updated = 0
    for notification in notifications:
        if _is_deleted_for_user(notification, current_user.username):
            continue
        if not _is_read_for_user(notification, current_user.username):
            _mark_read_for_user(notification, current_user.username)
            updated += 1
    db.commit()
    return {"status": "success", "updated": updated}


@router.delete("/clear-read")
def clear_read_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notifications = _notification_scope_query(db, current_user).all()
    deleted_ids = [
        notification.id
        for notification in notifications
        if _is_read_for_user(notification, current_user.username)
        and not _is_deleted_for_user(notification, current_user.username)
    ]
    for notification in notifications:
        if notification.id not in deleted_ids:
            continue

        if notification.target_username == current_user.username:
            db.delete(notification)
        else:
            _mark_deleted_for_user(notification, current_user.username)
    db.commit()
    return {"status": "success", "deleted_ids": deleted_ids}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notification = _notification_scope_query(db, current_user).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")

    if notification.target_username == current_user.username:
        db.delete(notification)
    else:
        _mark_deleted_for_user(notification, current_user.username)
    db.commit()
    return {"status": "success", "deleted_id": notification_id}
