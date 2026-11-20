import { playedFor, type ActivityLine } from '@/lib/account/activity';
import { ACTIVITY_LINE, NEUTRAL } from './activity-line';

/**
 * One thing done to a game, in one sentence: what, how long a finish took,
 * and the rating it came with ("Finished in 42h and rated it 9/10"). Each is
 * only there when there is one to say, and the sentence reads without it
 * ("Finished", "Finished and rated it 9/10"). A start that came from a pick
 * ends by saying which ("Started playing, picked at random"). Where it was
 * played is said beside the game's name, and when it happened at the row's
 * far end. Only what was done has the icon and the color; the rest reads on
 * from it.
 */
export function ActivityWhat({ line }: { line: ActivityLine }) {
  const { icon: Icon, text: color, what } = ACTIVITY_LINE[line.kind];
  // A finish of a game that isn't finished any more: said, without its green.
  const text = line.undone ? NEUTRAL : color;
  const rest = [
    line.kind === 'finished' && line.minutes && `in ${playedFor(line.minutes)}`,
    // A rating given by itself is the whole line ("Rated 9/10"): not said twice.
    line.rating != null &&
      line.kind !== 'rated' &&
      line.kind !== 'rerated' &&
      `and rated it ${line.rating}/10`,
  ].filter(Boolean);
  const picked =
    line.pickedBy === 'random'
      ? ', picked at random'
      : line.pickedBy === 'questions'
        ? ', picked by Pick My Game'
        : '';
  return (
    <span>
      <span className={text}>
        {/* In the line of text, not beside it: the words that follow sit on
            the same baseline as these. */}
        <Icon className="mr-1 inline-block h-3.5 w-3.5 align-[-0.125em]" aria-hidden="true" />
        {what(line)}
      </span>
      {rest.length > 0 && ` ${rest.join(' ')}`}
      {picked}
    </span>
  );
}
