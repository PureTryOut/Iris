import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { I18n } from '../../locale';
import Link from '../Link';
import Icon from '../Icon';
import {
  loadAlbum,
  loadArtist,
  loadTrack,
  loadTracks,
  removeTracksFromPlaylist,
  deletePlaylist,
} from '../../services/core/actions';
import {
  hideContextMenu,
  createNotification,
} from '../../services/ui/actions';
import {
  removeTracks,
} from '../../services/mopidy/actions';
import {
  following,
} from '../../services/spotify/actions';
import {
  getTrack,
  loveTrack,
  unloveTrack,
} from '../../services/lastfm/actions';
import {
  startRadio,
  addPinned,
  removePinned,
} from '../../services/pusher/actions';
import {
  titleCase,
} from '../../util/helpers';
import { arrayOf } from '../../util/arrays';
import { encodeUri } from '../../util/format';
import { enqueueURIs, playURIs } from '../../services/mopidy/actions';

const ContextMenuItems = ({
  context_menu,
  onSubmenu,
}) => {
  const {
    type,
    item,
    items,
    context,
  } = context_menu;
  const can_edit = context?.can_edit || item?.can_edit;
  const provider = context?.provider || item?.provider;

  switch (type) {
    case 'album': {
      return (
        <>
          <Play uris={[item.uri]} context={context} />
          <Enqueue uris={[item.uri]} context={context} next />
          <Enqueue uris={[item.uri]} context={context} />
          <Divider />
          {item.provider === 'spotify' && (
            <>
              <Library uri={item.uri} inLibrary={item.in_library} />
              <Divider />
            </>
          )}
          {item.artists?.length > 0 && <GoTo type="artist" uri={item.artists[0].uri} />}
          <Copy uris={[item.uri]} />
          <Refresh uri={item.uri} action={loadAlbum} />
        </>
      );
    }
    case 'artist': {
      const urisToPlay = item.tracks ? arrayOf('uri', item.tracks) : [item.uri];
      return (
        <>
          <Play uris={urisToPlay} context={context} />
          <Enqueue uris={urisToPlay} context={context} next />
          <Enqueue uris={urisToPlay} context={context} />
          {item.provider === 'spotify' && (
            <>
              <Radio uris={[item.uri]} />
              <Divider />
              <Library uri={item.uri} inLibrary={item.in_library} />
              <Divider />
              <Discover uris={[item.uri]} context={context} />
              <Divider />
            </>
          )}
          <Copy uris={[item.uri]} />
          <Refresh uri={item.uri} action={loadArtist} />
        </>
      );
    }
    case 'playlist': {
      return (
        <>
          <Play uris={[item.uri]} context={context} />
          <Enqueue uris={[item.uri]} context={context} next />
          <Enqueue uris={[item.uri]} context={context} />
          <Library uri={item.uri} inLibrary={item.in_library} />
          <Pin item={item} isPinned={item.is_pinned} />
          <Divider />
          {item.user && (
            <>
              <GoTo type="user" uri={item.user.uri} />
              <Divider />
            </>
          )}
          {item.can_edit && (
            <>
              <Edit uri={item.uri} type="playlist" />
              <Delete uri={item.uri} action={deletePlaylist} />
              <Divider />
            </>
          )}
          <Refresh uri={item.uri} action={loadTrack} />
          <Copy uris={[item.uri]} />
        </>
      );
    }
    case 'track': {
      return (
        <>
          <Play uris={[item.uri]} context={context} />
          <Enqueue uris={[item.uri]} context={context} next />
          <Enqueue uris={[item.uri]} context={context} />
          <Divider />
          <AddToPlaylist uris={[item.uri]} onClick={onSubmenu} />
          {provider === 'spotify' && <Library uri={item.uri} />}
          <Love uri={item.uri} />
          <Divider />
          {provider === 'spotify' && (
            <>
              <Discover uris={[item.uri]} context={context} />
              <GoTo type="track" uri={item.uri} />
              <Divider />
            </>
          )}
          <Copy uris={[item.uri]} />
          {can_edit && (
            <>
              <Divider />
              <Remove items={[item]} context={context} />
            </>
          )}
        </>
      );
    }
    case 'tracks': {
      const uris = arrayOf('uri', items);
      return (
        <>
          <Play uris={uris} context={context} />
          <Enqueue uris={uris} context={context} next />
          <Enqueue uris={uris} context={context} />
          <Divider />
          <AddToPlaylist uris={uris} onClick={onSubmenu} />
          {/* No support for adding/removing/checking library for multiple URIs (yet) */}
          <Divider />
          {provider === 'spotify' && (
            <>
              <Radio uris={uris} disabled={uris.length > 5} />
              <Discover uris={uris} context={context} disabled={uris.length > 5} />
              <Divider />
            </>
          )}
          <Copy uris={uris} />
          {can_edit && (
            <>
              <Divider />
              <Remove items={items} context={context} />
            </>
          )}
        </>
      );
    }
    default: {
      return (
        <>
          <Play uris={arrayOf('uri', items)} context={context} />
          <Enqueue uris={arrayOf('uri', items)} context={context} next />
          <Enqueue uris={arrayOf('uri', items)} context={context} />
          <Divider />
          <Copy uris={arrayOf('uri', items)} />
        </>
      );
    }
  }
};

const Divider = () => <div className="context-menu__divider" />;

const Refresh = ({
  uri,
  uris,
  action,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(action(uri || uris, { forceRefetch: true, full: true }));
    dispatch(hideContextMenu());
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="context_menu.refresh" />
        </span>
      </a>
    </div>
  );
};

const Discover = ({
  uris,
  disabled,
}) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(hideContextMenu());
    const discoverUri = encodeUri(`iris:discover:${uris.map((uri) => encodeUri(uri)).join(',')}`);
    history.push(`/discover/recommendations/${discoverUri}`);
  };
  return (
    <div className={`context-menu__item ${disabled && 'context-menu__item--disabled'}`}>
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="context_menu.discover_similar" />
        </span>
      </a>
    </div>
  );
};

const Library = ({
  uri,
  inLibrary: inLibraryProp,
}) => {
  const dispatch = useDispatch();
  const [inLibrary, setInLibrary] = useState(inLibraryProp);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (inLibraryProp === undefined) {
      setLoading(true);
      dispatch(following(
        uri,
        'GET',
        (result) => {
          setLoading(false);
          setInLibrary(result);
        },
      ));
    }
  }, [uri]);
  const onClick = () => {
    dispatch(hideContextMenu());
    dispatch(following(uri, inLibrary ? 'DELETE' : 'PUT'));
  };
  return (
    <div className={`context-menu__item ${loading && 'context-menu__item--disabled'}`}>
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path={`actions.${inLibrary ? 'remove_from' : 'add_to'}_library`} />
        </span>
      </a>
    </div>
  );
};

const Love = ({
  uri,
  isLoved: isLovedProp,
}) => {
  const dispatch = useDispatch();
  const [isLoved, setIsLoved] = useState(isLovedProp);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isLovedProp === undefined) {
      setLoading(true);
      dispatch(getTrack(
        uri,
        (result) => {
          setLoading(false);
          setIsLoved(result);
        },
      ));
    }
  }, [uri]);
  const onClick = () => {
    dispatch(hideContextMenu());
    dispatch(isLoved ? unloveTrack(uri) : loveTrack(uri));
  };
  return (
    <div className={`context-menu__item ${loading && 'context-menu__item--disabled'}`}>
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path={`context_menu.${isLoved ? 'un' : ''}love_track`} />
        </span>
      </a>
    </div>
  );
};

const Pin = ({
  item,
  isPinned,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(hideContextMenu());
    if (isPinned) {
      dispatch(removePinned(item.uri));
    } else {
      dispatch(addPinned(item));
    }
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path={`context_menu.${isPinned ? 'un' : ''}pin`} />
        </span>
      </a>
    </div>
  );
};

const GoTo = ({
  type,
  uri,
}) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(hideContextMenu());
    history.push(`/${type}/${encodeUri(uri)}`);
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path={`context_menu.go_to_${type}`} />
        </span>
      </a>
    </div>
  );
};

const Edit = ({
  uri,
  type,
}) => {
  return (
    <div className="context-menu__item">
      <Link
        className="context-menu__item__link"
        to={`/modal/edit-${type}/${encodeUri(uri)}`}
      >
        <span className="context-menu__item__label">
          <I18n path="actions.edit" />
        </span>
      </Link>
    </div>
  );
};

const Delete = ({
  uri,
  action,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(hideContextMenu());
    dispatch(action(uri));
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="actions.delete" />
        </span>
      </a>
    </div>
  );
};

const Play = ({
  uris,
  context,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(playURIs(uris, context));
    dispatch(hideContextMenu());
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="actions.play" />
        </span>
      </a>
    </div>
  );
};

const Enqueue = ({
  uris,
  next,
  context,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(enqueueURIs(uris, context, next));
    dispatch(hideContextMenu());
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path={next ? 'context_menu.play_next' : 'actions.add_to_queue'} />
        </span>
      </a>
    </div>
  );
};

const AddToPlaylist = ({
  onClick,
}) => {
  return (
    <div className="context-menu__item context-menu__item--has-submenu">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="context_menu.add_to_playlist.title" />
        </span>
        <Icon className="submenu-icon" name="arrow_forward" />
      </a>
    </div>
  );
};

const Remove = ({
  items,
  context: {
    type,
    uri,
  },
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    switch (type) {
      case 'playlist': {
        dispatch(removeTracksFromPlaylist(uri, arrayOf('index', items)));
        break;
      }
      case 'queue': {
        dispatch(removeTracks(arrayOf('tlid', items)));
        break;
      }
      default:
        break;
    }
    dispatch(hideContextMenu());
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="actions.remove" />
        </span>
      </a>
    </div>
  );
};

const Radio = ({
  uris,
  disabled,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    dispatch(hideContextMenu());
    dispatch(startRadio(uris))
  };
  return (
    <div className={`context-menu__item ${disabled && 'context-menu__item--disabled'}`}>
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="context_menu.start_radio" />
        </span>
      </a>
    </div>
  );
};

const Copy = ({
  uris,
}) => {
  const dispatch = useDispatch();
  const onClick = () => {
    const temp = $('<input>');
    $('body').append(temp);
    temp.val(uris.join(',')).select();
    document.execCommand('copy');
    temp.remove();

    dispatch(createNotification({ content: `Copied ${uris.length} URIs` }));
    dispatch(hideContextMenu());
  };
  return (
    <div className="context-menu__item">
      <a className="context-menu__item__link" onClick={onClick}>
        <span className="context-menu__item__label">
          <I18n path="context_menu.copy_uri" />
        </span>
      </a>
    </div>
  );
};

export default {
  ContextMenuItems,
};

export {
  ContextMenuItems,
};