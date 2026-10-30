import { SUBSTACK_HOME } from '../lib/substack';

export function GET() {
	return Response.redirect(`${SUBSTACK_HOME}/feed`, 302);
}
