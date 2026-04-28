from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from .db import SessionLocal
from .models import Card
from .utils.auto_framing import calculate_auto_frame_params
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def run_image_position_updates():
    """
    Nightly cron job to update missing photo_x, photo_y, and photo_scale
    using the auto-framing logic.
    """
    logger.info("Running nightly image position update cron job...")
    db: Session = SessionLocal()
    try:
        # Find all cards where manual tweaking hasn't occurred
        cards = db.query(Card).filter(
            Card.photo_x == 0,
            Card.photo_y == 0,
            Card.photo_scale == "1.0",
            Card.photo_data != None
        ).all()
        
        updated_count = 0
        for card in cards:
            if not card.photo_data:
                continue
            
            x, y, scale = calculate_auto_frame_params(card.photo_data)
            
            # If default 0,0,1 was returned, algorithm failed or contour wasn't found
            if x == 0 and y == 0 and float(scale) == 1.0:
                continue
                
            card.photo_x = x
            card.photo_y = y
            card.photo_scale = str(scale)
            updated_count += 1
            
        db.commit()
        logger.info(f"Successfully processed {updated_count} untouched cards.")
    except Exception as e:
        logger.error(f"Failed to run cron job: {e}")
        db.rollback()
    finally:
        db.close()

def start_scheduler():
    # Schedule the job to run every day at 21:00 (9:00 PM)
    scheduler.add_job(run_image_position_updates, 'cron', hour=21, minute=0)
    scheduler.start()
    logger.info("Background scheduler initialized.")
