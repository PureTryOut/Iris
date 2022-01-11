import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { uniqBy } from 'lodash';
import Track from './Track';
import * as mopidyActions from '../services/mopidy/actions';
import * as uiActions from '../services/ui/actions';
import { isTouchDevice, uriSource } from '../util/helpers';
import { arrayOf, indexToArray } from '../util/arrays';
import { i18n } from '../locale';
import { SmartList } from './SmartList';
import { formatSimpleObject } from '../util/format';

const TrackList = ({
  uri,
  context,
  className = '',
  show_source_icon,
  play_state,
  slim_mode,
  tracks,
  selected_tracks,
  removeTracks,
  playTracks,
  reorderTracks,
  context_menu,
  dragger,
  uiActions: {
    createNotification,
    showContextMenu,
    dragStart,
    dragEnd,
  },
  mopidyActions: {
    playURIs,
  },
}) => {
  const [selected, setSelected] = useState([]);
  const [dropTarget, setDropTarget] = useState(null);
  const [transformingItems, setTransformingItems] = useState([]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown, false);
    return () => {
      window.removeEventListener('keydown', onKeyDown, false);
    };
  }, []);

  const onKeyDown = (e) => {
    const {
      key,
      altKey,
      ctrlKey,
      metaKey,
      shiftKey,
    } = e;

    // When we're focussed on certian elements, don't fire any shortcuts
    // Typically form inputs
    const ignoreNodes = ['INPUT', 'TEXTAREA'];
    if (ignoreNodes.indexOf(e.target.nodeName) > -1) {
      return;
    }

    // Ignore when there are any key modifiers. This enables us to avoid interfering
    // with browser- and OS-default functions.
    if (altKey || ctrlKey || metaKey || shiftKey) {
      return;
    }

    switch (key.toLowerCase()) {
      case 'enter':
        if (selected.length > 0) {
          onPlayTracks();
        }
        e.preventDefault();
        break;
      case 'backspace':
      case 'delete':
        if (selected.length > 0) {
          onRemoveTracks();
        }
        e.preventDefault();
        break;
      case 'a':
        setSelected(tracks.map((item, index) => ({ item, index })));
        e.preventDefault();
        break;
      default:
        break;
    }
  }

  const events = {
    onDrop: (index) => {
      reorderTracks(arrayOf('index', selected), index);
      setSelected([]);
      setDropTarget(null);
    },
    onMouseDown: (item, index, e) => {
      if (selectionIndexByItemIndex(index) === -1) {
        e.persist();
        setSelected((prev) => nextSelected(prev, item, index, e));
      }
    },
    onDoubleClick: (item, index) => {
      // if (context_menu) hideContextMenu();
      setSelected([{ item, index }]);
      playURIs([item.uri], context);
    },
    onContextMenu: (item, index, e) => {
      // Do our best to stop any flow-on events
      e.preventDefault();
      e.stopPropagation();
      e.cancelBubble = true;
      const items = getOrUpdateSelected(item, index, e).map(
        ({ index, item }) => ({ index, ...item }),
      );

      showContextMenu({
        e,
        context,
        ...(items.length === 1
          ? { type: 'track', item: items[0] }
          : { type: 'tracks', items }
        ),
      });
    },
  };

  /**
   * NEXT STEPS
   * Collate these events into a coherant package, possibly using hooks?
   * Create redux handlers to push dragging items into state. This allows a nice drag shadow and
   *  activation of dropzones in sidebar.
   * Figure out where to leave touch events. Perhaps dragging one-by-one with a simple handle is
   *  sufficient.
   * Apply drag-ability to other assets, like album tiles, etc.
   * 
   * Also, fix shuffle play; first track goes first, but all subsequent ones go to end of tracklist
   */

  const onRemoveTracks = () => {
    if (!removeTracks) {
      createNotification({
        content: `Cannot delete ${selected.length > 1 ? 'these tracks' : 'this track'}`,
        level: 'error',
      });
      return;
    }
    removeTracks(selected.map(({ index }) => index));
  };

  const selectionIndexByItemIndex = (index) => (
    selected && selected.length > 0
      ? selected.findIndex(({ index: selectedIndex }) => selectedIndex === index)
      : -1
  );

  // Based on a single track's event, procure the next selected array and update the state
  // Target not selected = select it
  // Target selected = leave as-is and return current selection
  const getOrUpdateSelected = (item, index, e) => {
    const alreadySelected = selectionIndexByItemIndex(index);
    let items = [];
    if (alreadySelected > -1) {
      items = selected;
    } else {
      items = nextSelected(selected, item, index, e);
      setSelected(items);
    }
    return items;
  }

  const nextSelected = (prev, item, index, e = {}, sticky = false) => {
    const alreadySelected = selectionIndexByItemIndex(index);

    if (e.shiftKey) {
      const { index: lastSelectedIndex } = selected[selected.length-1] || { index };
      const next = [...prev, { index, item }];
      const from = lastSelectedIndex < index ? lastSelectedIndex : index;
      const to = lastSelectedIndex > index ? lastSelectedIndex : index;
      for (let i = from; i < to; i++) {
        next.push({ index: i, item: tracks[i] });
      }
      return uniqBy(next, 'index');
    }
    if (e.ctrlKey) {
      if (alreadySelected >= 0 && !sticky) {
        const next = [...prev];
        next.splice(alreadySelected, 1);
        return next;
      }
      return [...prev, { item, index }];
    }
    return [{ item, index }];
  };

  if (!tracks || Object.prototype.toString.call(tracks) !== '[object Array]') {
    return null;
  }

  const is_selected = (index) => selected.find(({ index: i }) => index === i);
  const is_transforming = (index) => transformingItems.indexOf(index) > -1;
  const getDragItem = (item, index) => {
    let selectedForDrag = selected;
    if (selectionIndexByItemIndex(index) === -1) {
      selectedForDrag = nextSelected(selected, item, index);
      // setSelected(selectedForDrag);
    }
    return {
      selected: selectedForDrag,
      context,
    };
  };

  return (
    <SmartList
      className={`list list--tracks ${className}`}
      items={tracks}
      itemComponent={Track}
      itemProps={{
        dragger,
        play_state,
        show_source_icon,
        context,
        getDragItem,
        can_sort: context?.can_edit,
        is_selected,
        is_transforming,
        mini_zones: slim_mode || isTouchDevice(),
        events,
      }}
    />
  );
};

const mapStateToProps = (state) => ({
  play_state: state.mopidy.play_state,
  slim_mode: state.ui.slim_mode,
  selected_tracks: state.ui.selected_tracks,
  dragger: state.ui.dragger,
  current_track: state.core.current_track,
  context_menu: state.ui.context_menu,
  stream_title: state.core.stream_title,
});

const mapDispatchToProps = (dispatch) => ({
  mopidyActions: bindActionCreators(mopidyActions, dispatch),
  uiActions: bindActionCreators(uiActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(TrackList);
