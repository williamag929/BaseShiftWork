import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useTagRelaunch } from '../useTagRelaunch';

const KEY = 'AAAAAAAAAAAAAAAAAAAAAA';
const OTHER = 'BBBBBBBBBBBBBBBBBBBBBB';

function setup(tagKey: string | null = KEY) {
  const remove = jest.fn();
  let handler: (e: { url: string }) => void = () => {};
  jest.spyOn(Linking, 'addEventListener').mockImplementation(((_: string, h: any) => {
    handler = h;
    return { remove };
  }) as any);
  (Linking.addEventListener as jest.Mock).mockClear();
  const onRelaunch = jest.fn();
  const hook = renderHook(() => useTagRelaunch(tagKey, onRelaunch));
  return { emit: (url: string) => handler({ url }), onRelaunch, remove, hook };
}

afterEach(() => jest.restoreAllMocks());

it('calls onRelaunch for a link to the same tag', () => {
  const { emit, onRelaunch } = setup();
  emit(`https://t.loqzen.com/t/${KEY}`);
  expect(onRelaunch).toHaveBeenCalledTimes(1);
});

it('ignores a different tag or an unrelated url', () => {
  const { emit, onRelaunch } = setup();
  emit(`https://t.loqzen.com/t/${OTHER}`);
  emit('https://example.com/');
  expect(onRelaunch).not.toHaveBeenCalled();
});

it('removes the listener on unmount', () => {
  const { hook, remove } = setup();
  hook.unmount();
  expect(remove).toHaveBeenCalled();
});

it('does not subscribe without a tag key', () => {
  setup(null);
  expect(Linking.addEventListener).not.toHaveBeenCalled();
});
