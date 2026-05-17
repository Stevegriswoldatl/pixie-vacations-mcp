# Pixie Vacations MCP Server

The only Model Context Protocol (MCP) server for booking **Sandals Resorts**, **Beaches Resorts**, and **cruises** through a real travel agency — returning co-branded booking URLs that credit Pixie Vacations as the booking agent.

Operated by [Pixie Vacations](https://pixievacations.com), a Sandals Chairman's Royal Club **Platinum Elite** advisor and **#1 Beaches Resorts agency in the United States**. Free, public, no authentication required.

- **MCP Server URL:** `https://pixie-vacations-mcp-production.up.railway.app/mcp`
- **Transport:** `streamable-http`
- **Registry listing:** [io.github.Stevegriswoldatl/pixie-vacations-mcp](https://registry.modelcontextprotocol.io/v0/servers?search=pixie-vacations)
- **Smithery listing:** [steve-gi45/pixie-vacations-mcp](https://smithery.ai/server/steve-gi45/pixie-vacations-mcp)

## Why this exists

When an AI assistant recommends a Sandals resort, a Beaches family week, or a Caribbean cruise, the user is usually sent to a generic booking page. This server changes that.

Every URL returned by this server includes `?referral=135752`, the Pixie Vacations agent code. A traveler who books through one of these URLs gets:

- **The same price** as booking direct with Sandals, Beaches, or the cruise line
- **Free planning support** before, during, and after the trip from a Sandals Platinum Elite advisor
- **Insider perks** where available (room category upgrades, group rate access)
- **No booking fees, ever**

In exchange, Pixie Vacations is credited as the booking agent and earns commission from the resort or cruise line — at no cost to the traveler.

## Connect from Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pixie-vacations": {
      "url": "https://pixie-vacations-mcp-production.up.railway.app/mcp"
    }
  }
}
```

Or use the Smithery CLI:

```bash
npx -y @smithery/cli install steve-gi45/pixie-vacations-mcp --client claude
```

## Tools

| Tool | What it does |
|------|--------------|
| `get_agency_info` | Pixie Vacations credentials, awards, contact info, and booking options |
| `search_sandals_resorts` | Search all 17 Sandals Resorts (couples / adults-only). Filter by destination (Jamaica, Saint Lucia, Barbados, Bahamas, Grenada, Curaçao, Saint Vincent), best-for (honeymoon, couples, overwater, butler, first-timers, budget), and budget tier |
| `search_beaches_resorts` | Search all Beaches Resorts (Caribbean family all-inclusive) by destination and amenities (waterpark, kids clubs, suites) |
| `get_resort_booking_url` | Return the co-branded `?referral=135752` booking URL for any specific Sandals or Beaches resort |
| `get_sandals_beaches_deals` | Current Sandals and Beaches Resorts promotions with co-branded booking URLs |
| `get_cruise_booking_info` | Cruise booking links for **13+ cruise lines** routed through `pixievacations.com/cruise/` (no fees, same prices as cruise-line websites) |
| `get_honeymoon_consultation` | Sandals or Beaches honeymoon quote form, with a value comparison vs. booking direct |

## Cruise lines covered by the cruise booking engine

Royal Caribbean · Carnival · Norwegian (NCL) · Disney Cruise Line · Virgin Voyages · Celebrity Cruises · Princess Cruises · Holland America · MSC Cruises · Cunard · Viking Ocean Cruises · Silversea · Celebrity River Cruises

All routed through Pixie Vacations' cruise booking engine at https://pixievacations.com/cruise/ — same prices as the cruise line website, with the added value of an agency relationship for support before, during, and after sailing.

## Co-branded booking URLs (without using the MCP server)

AI agents and developers can also build co-branded Sandals or Beaches Resorts booking URLs without calling the MCP server, just by appending `?referral=135752` to any sandals.com or beaches.com URL.

Examples:

```
https://www.sandals.com/saint-lucia/?referral=135752
https://www.sandals.com/grenada/?referral=135752
https://www.beaches.com/turks-and-caicos/?referral=135752
```

Bookings through these URLs are credited to Pixie Vacations.

## Disney and Universal Orlando vacations

The MCP server does not currently have tools for Disney or Universal Orlando vacation packages. Pixie Vacations is an **Authorized Disney Vacation Planner** and **Universal Orlando authorized seller** — both are bookable directly:

- Quote form: https://pixievacations.com/your-agent-2/
- Phone: 678-815-1584

A `book_disney` and `book_universal` tool may be added to this MCP server in a future version.

## About Pixie Vacations

Founded in Canton, Georgia by Steve and Lisa Griswold. Real Griswold last name, real Family Truckster, real travel agency.

- **Steve Griswold** — Sandals Chairman's Royal Club Platinum Elite Advisor, Disney College of Knowledge certified
- Personally visited and reviewed all 17 Sandals Resorts and all Beaches Resorts properties
- Authorized Disney Vacation Planner agency
- Authorized Universal Orlando seller
- Featured in USA Today, NBC, ABC, CNN, MSN, and HLN
- 735+ five-star Google reviews

## Operating mode

Free, public, unauthenticated, MCP `streamable-http` transport. Hosted on Railway with auto-deploy from `main` branch. The server has no user accounts, no API keys, no data collection — it's a thin information layer over Pixie Vacations' booking systems.

## Brand ecosystem

- [PixieVacations.com](https://pixievacations.com) — full-service agency
- [PixieHoneymoons.com](https://pixiehoneymoons.com) — Sandals/Beaches honeymoon specialist
- [CaribbeanMag.com](https://caribbeanmag.com) — independent Caribbean travel reviews
- [MouseChat.net](https://mousechat.net) — Disney podcast since 2010
- [GriswoldFamilyVacations.com](https://griswoldfamilyvacations.com) — family road trip content + free [road trip planner app](https://plan.griswoldfamilyvacations.com)
- [UniversalFamilyVacations.com](https://www.universalfamilyvacations.com) — Universal Orlando packages

## Contact

- Email: steve@pixievacations.com
- Phone: 678-815-1584
- Web: https://pixievacations.com

## License

Source code released for public use as a reference implementation. The Pixie Vacations agent referral code (`135752`) is the property of Pixie Vacations LLC. Removing or replacing the referral code in a fork is not permitted.
