import React from 'react';
import Markdown from 'react-markdown';
import {withTracker} from 'meteor/react-meteor-data';
import {compose, withState, branch, renderComponent} from 'recompact';
import styled from 'styled-components';

import * as v from './visual';
import prevent from './prevents-default';
import getFormData from './form-data';
import {Cards} from '../shared/collections';
import slug from './slug';

const connectCard = withTracker(({_id, related}) => ({
	relatedCards: Cards.find({
		_id: {$in: related || []}
	}).fetch(),

	setSelected() {
		if(Session.get('selectedCard') === _id) {
			Session.set('selectedCard', null);
		} else {
			Session.set('selectedCard', _id);
		}
	},

	removeRelated(related) {
		Cards.update(_id, {
			$pull: {related},
		});

		Cards.update(related, {
			$pull: {related: _id},
		});
	},

	addTag(ev) {
		const {tag} = getFormData(ev);
		Cards.update(_id, {
			$addToSet: {tags: tag}
		});
	},

	removeTag(tag) {
		Cards.update(_id, {
			$pull: {tags: tag}
		});
	},
}));

const connectAddRelated = withTracker(({card, exclude}) => ({
	cards: Cards.find({
		_id: {$nin: exclude}
	}, {
		sort: {
			title: 1
		}
	}).fetch(),

	addRelated(ev) {
		const related = ev.target.selectedOptions[0].value;

		Cards.update(card, {
			$addToSet: {related},
		});

		Cards.update(related, {
			$addToSet: {related: card},
		});

		ev.target.selectedIndex = 0;
	}
}));

const NarrowSelect = v.Select.extend`
	max-width: 7em;
`;

const AddRelated = connectAddRelated(({cards = [], addRelated}) => cards.length ? <NarrowSelect small defaultValue='' onChange={addRelated}>
	<option value='' disabled>Link...</option>
	{cards.map(
		card => <option value={card._id} key={card._id}>{card.title}</option>
	)}
</NarrowSelect> : null);

const Vertical = v.Box.extend`
	position: relative;
	display: flex;
	flex-direction: column;
`;

const Bottom = styled.div`
	margin-top: auto;
	padding-top: 1em;
	border-top: 1px solid lightgrey;
`;

const Floating = styled.div`
	position: absolute;
	top: 1em;
	right: 1em;
`;

const TitleLink = styled.a`
	&, &:link, &:visited {
		color: inherit;
		text-decoration: none;
	}

	&:hover {
		color: dodgerblue;
		text-decoration: underline;
		text-decoration-skip: ink;
	}

	&:active {
		color: cornflowerblue;
	}
`

const ShowCard = connectCard(({
	_id,
	title,
	text = '',
	related = [],
	relatedCards,
	tags = [],
	setEditing,
	setSelected,
	removeRelated,
	addTag,
	removeTag,
	isSelected
}) => <Vertical>
	<Floating><v.Button onClick={() => setEditing(true)}>✎</v.Button></Floating>
	<v.Title><TitleLink href={`#${_id}`} onClick={setSelected}>{title}</TitleLink></v.Title>
	<Markdown source={text} />

	<Bottom>
		<v.List>
			{tags.map(tag => <v.ColoredTag key={tag} onClick={() => removeTag(tag)}>{tag}</v.ColoredTag>)}
			<form onSubmit={addTag}>
				<v.Input placeholder='Tag...' size={7} name='tag' list='tags-list' small />
			</form>
			<v.Sep />
			{relatedCards.map(card => <v.Tag key={card._id} onClick={() => removeRelated(card._id)}>{card.title}</v.Tag>)}
			<AddRelated card={_id} exclude={related.concat(_id)} />
		</v.List>
	</Bottom>
</Vertical>);

const editCardAction = withTracker(({_id, title, setEditing, prelinked}) => ({
	prelinkedCard: Cards.findOne(prelinked),

	onSubmit(ev) {
		const data = getFormData(ev);

		if(_id) {
			Cards.update(_id, {$set: data});
		} else {
			data.tags = Session.get('filterTags') || [];
			data.related = prelinked ? [prelinked] : [];
			data._id = slug(data.title);

			Cards.insert(data, (err, _id) => {
				if(prelinked && !err) {
					Cards.update(prelinked, {
						$addToSet: {
							related: _id,
						},
					});
				}
			});
		}

		setEditing && setEditing(false);
	},

	deleteCard() {
		if(confirm(`Delete "${title}"?`)) {
			Cards.remove(_id);
			Cards.find({related: _id}).forEach(card => {
				Cards.update(card._id, {
					$pull: {related: _id},
				});
			});
		}
	}
}));

const FlexForm = styled.form`
	height: 100%;
	display: flex;
	flex-direction: column;
`;

const FlexLabel = v.Label.extend`
	display: flex;
	flex-direction: column;
	flex: 1;

	${v.Textarea} {
		flex: 1;
	}
`;

export const EditCard = editCardAction(({_id, deleteCard, title, text, onSubmit, setEditing, prelinkedCard}) => <v.Box>
	<FlexForm onSubmit={onSubmit}>
		<v.Label>Title <v.Input required name='title' defaultValue={title} /></v.Label>
		<FlexLabel><v.Textarea name='text' defaultValue={text} rows={5} /></FlexLabel>

		<v.List>
			{prelinkedCard && <v.Tag>{prelinkedCard.title}</v.Tag>}
			{_id && <v.Button color='crimson' onClick={prevent(deleteCard)}>Delete</v.Button>}

			<v.Right>
				{setEditing && <v.Button color='grey' onClick={prevent(() => setEditing(false))}>Cancel</v.Button>}
				<v.Button color={!_id ? 'mediumseagreen' : undefined}>{_id ? 'Save' : 'Add'}</v.Button>
			</v.Right>
		</v.List>
	</FlexForm>
</v.Box>);

export const Card = compose(
	withState('editing', 'setEditing', false),
	branch(
		({editing}) => editing,
		renderComponent(EditCard)
	)
)(ShowCard);
