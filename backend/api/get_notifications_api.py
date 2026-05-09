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
            .limit(20)
            .all()
        )

        # 2. Add a 'System' notification if the RAM Buffer is active but no DB alerts exist
        # This helps the user know the system is alive even if the DB is fresh
        results = []
        for n in notifs:
            results.append({
                "id": n.id,
                "message": n.message,
                "type": "warning" if "risk" in n.message.lower() else "info",
                "is_read": n.is_read,
                "time": n.timestamp.strftime("%d %b %Y, %I:%M %p") if n.timestamp else "Just now"
            })

        # Fallback: If DB is empty but data is loaded in RAM
        if not results and getattr(request.app.state, 'raw_df', None) is not None:
            results.append({
                "id": 0,
                "message": "Neural Buffer Secured: 150 records awaiting analysis.",
                "type": "success",
                "is_read": False,
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

    notification.is_read = True
    db.commit()
    return {"status": "success", "message": "Notification marked as read."}


@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notifications = _notification_scope_query(db, current_user).filter(Notification.is_read == False).all()
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return {"status": "success", "updated": len(notifications)}


@router.delete("/clear-read")
def clear_read_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notifications = _notification_scope_query(db, current_user).filter(Notification.is_read == True).all()
    deleted_ids = [notification.id for notification in notifications]
    for notification in notifications:
        db.delete(notification)
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

    db.delete(notification)
    db.commit()
    return {"status": "success", "deleted_id": notification_id}
