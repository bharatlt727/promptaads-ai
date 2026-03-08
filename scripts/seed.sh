#!/usr/bin/env bash
set -euo pipefail

# PromptAds AI - Seed Script
# Seeds the database with sample data for development
# ────────────────────────────────────────

echo "🌱 Seeding PromptAds AI database..."

cd "$(dirname "$0")/../backend"
source .venv/bin/activate 2>/dev/null || { echo "Run setup.sh first"; exit 1; }

python -c "
import asyncio
from app.db.session import async_session_factory
from app.db.models.advertiser import Advertiser
from app.db.models.campaign import Campaign, CampaignStatus, BiddingStrategy
from app.db.models.ad import Ad
from app.db.models.developer import Developer
from app.db.models.app import App
from app.services.auth import hash_password, generate_api_key, generate_app_key

async def seed():
    async with async_session_factory() as db:
        # Create sample advertiser
        advertiser = Advertiser(
            email='demo@webflow.com',
            hashed_password=hash_password('demo1234'),
            company_name='Webflow',
            website='https://webflow.com',
            industry='Web Development',
            balance=1000.0,
            is_verified=True,
        )
        db.add(advertiser)
        await db.flush()

        # Create campaign
        campaign = Campaign(
            advertiser_id=advertiser.id,
            name='Website Builder Campaign',
            status=CampaignStatus.ACTIVE,
            daily_budget=50.0,
            total_budget=1000.0,
            bidding_strategy=BiddingStrategy.CPC,
            bid_amount=0.05,
        )
        db.add(campaign)
        await db.flush()

        # Create ads
        ads = [
            Ad(
                campaign_id=campaign.id,
                headline='Build websites visually with Webflow',
                body='Webflow empowers developers to design, build, and launch responsive websites visually — without writing code.',
                cta_text='Try Webflow free',
                destination_url='https://webflow.com',
                keywords=['website builder', 'web development', 'no-code', 'design', 'responsive'],
                categories=['web-development', 'design-tools'],
                is_active=True,
                is_approved=True,
            ),
            Ad(
                campaign_id=campaign.id,
                headline='Webflow for developers',
                body='Build production-grade websites with clean, semantic code output. Full CMS, hosting, and SEO built in.',
                cta_text='Start building',
                destination_url='https://webflow.com/developers',
                keywords=['web development', 'CMS', 'hosting', 'SEO', 'developer tools'],
                categories=['web-development', 'developer-tools'],
                is_active=True,
                is_approved=True,
            ),
        ]
        db.add_all(ads)

        # Create sample developer
        developer = Developer(
            email='dev@example.com',
            hashed_password=hash_password('demo1234'),
            name='Demo Developer',
            api_key=generate_api_key(),
        )
        db.add(developer)
        await db.flush()

        # Create sample app
        app = App(
            developer_id=developer.id,
            name='Demo AI Chat',
            description='A demo AI chatbot with contextual ads',
            app_key=generate_app_key(),
            categories=['general'],
        )
        db.add(app)

        await db.commit()
        print(f'✅ Created advertiser: {advertiser.email}')
        print(f'✅ Created campaign: {campaign.name} with {len(ads)} ads')
        print(f'✅ Created developer: {developer.email} (API key: {developer.api_key})')
        print(f'✅ Created app: {app.name} (App key: {app.app_key})')

asyncio.run(seed())
"

echo "🌱 Seeding complete!"
